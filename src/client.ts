// REST client for the Unfold external API (/api/v1/ext/*)

import type {
  AssessmentInput,
  ExtGoalCreated,
  ExtGoalStatus,
  ExtGoalListResponse,
  ExtUnfoldResponse,
  ExtClarifySubmitResponse,
  ExtImportResponse,
  ExtAnalyticsResult,
  GenerateAssessmentResponse,
  ScoreAssessmentResponse,
  AssessmentCapabilities,
  ResourceCategory,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.unfoldit.com";
const DEFAULT_TIMEOUT_MS = parseInt(
  process.env.UNFOLD_MCP_REQUEST_TIMEOUT_MS || "30000",
  10
);

/**
 * Typed error from the Unfold API. Preserves the backend's structured
 * error envelope (error_code, message, settings_url, switch_to_unfold_ai,
 * supported types, etc.) so agents can branch on `errorCode` rather than
 * having to regex-parse a stringified message.
 *
 * Known error codes (see backend errors.py for the source of truth):
 *   - "models_not_configured" / "provider_unauthorized" /
 *     "provider_quota_exceeded" / "provider_unavailable" /
 *     "provider_request_invalid" -- LLM provider issues, per
 *     CLAUDE.md taxonomy. Some carry a `switch_to_unfold_ai` block.
 *   - "validation_failed" -- generation produced output that failed
 *     structural/semantic validation after retry budget.
 *   - "token_invalid" / "assessment_expired" -- assessment token
 *     tampered or past its TTL.
 *   - "assessment_type_not_supported" -- assessment_type is
 *     recognised but its prompt builder is not yet wired (e.g.
 *     clinical_intake before partner integration). Carries
 *     `supported` list with the (assessment_type, schema_version)
 *     pairs that ARE wired.
 *   - "idempotency_conflict" -- same request_id was used with a
 *     different request body.
 */
export class UnfoldApiError extends Error {
  status: number;
  errorCode: string | null;
  details: Record<string, unknown>;

  constructor(status: number, message: string, errorCode: string | null, details: Record<string, unknown>) {
    super(message);
    this.name = "UnfoldApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }

  /** Structured payload for surfacing to MCP clients / agents. */
  toPayload(): Record<string, unknown> {
    return {
      error_code: this.errorCode ?? "unknown",
      status: this.status,
      message: this.message,
      ...this.details,
    };
  }
}

function parseApiError(status: number, body: unknown): UnfoldApiError {
  // FastAPI wraps responses in {"detail": ...}. The detail can be:
  //  - a typed dict like {"error_code": ..., "message": ..., "..."}
  //  - a plain string
  //  - a list of validation errors (Pydantic ValidationError)
  // We unwrap the typed-dict case and preserve the rest verbatim in
  // `details` so agents can branch on whatever the backend sent.
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const detail = obj.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const d = detail as Record<string, unknown>;
      const code = typeof d.error_code === "string" ? d.error_code : null;
      const msg = typeof d.message === "string" ? d.message : `Unfold API error (${status})`;
      const { error_code: _ec, message: _msg, ...rest } = d;
      return new UnfoldApiError(status, msg, code, rest);
    }
    if (typeof detail === "string") {
      return new UnfoldApiError(status, detail, null, {});
    }
    // 422 validation errors: list under detail; surface as-is.
    if (Array.isArray(detail)) {
      return new UnfoldApiError(
        status,
        `Unfold API validation error (${status})`,
        "validation_error",
        { validation_errors: detail },
      );
    }
    // Fallback: typed envelope at top level (no detail wrapper).
    if (typeof obj.error_code === "string") {
      const code = obj.error_code;
      const msg = typeof obj.message === "string" ? obj.message : `Unfold API error (${status})`;
      const { error_code: _ec, message: _msg, ...rest } = obj;
      return new UnfoldApiError(status, msg, code, rest);
    }
  }
  return new UnfoldApiError(
    status,
    `Unfold API error (${status}): ${typeof body === "string" ? body : JSON.stringify(body)}`,
    null,
    {},
  );
}

export class UnfoldClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1/ext${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new Error(
          `Request timed out after ${timeoutMs}ms: ${method} ${path}`
        );
      }
      throw err;
    }

    if (!res.ok) {
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = await res.text();
      }
      throw parseApiError(res.status, parsed);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async createGoal(params: {
    title: string;
    description?: string;
    additionalContext?: string;
    clarificationContext?: {
      experienceLevel?: string;
      timeline?: string;
      constraints?: string;
      resources?: string;
      successCriteria?: string;
    };
    context?: string;
    priority?: string;
    claimExpiresInDays?: number;
    progressShare?: boolean;
    metadata?: Record<string, string>;
    assessment?: AssessmentInput;
  }): Promise<ExtGoalCreated> {
    return this.request<ExtGoalCreated>("POST", "/goals", {
      title: params.title,
      description: params.description,
      additionalContext: params.additionalContext,
      clarificationContext: params.clarificationContext,
      context: params.context || "professional",
      priority: params.priority || "medium",
      claimExpiresInDays: params.claimExpiresInDays || 30,
      progressShare: params.progressShare !== false
        ? { enabled: true }
        : undefined,
      metadata: params.metadata,
      assessment: params.assessment,
    });
  }

  async getGoalStatus(goalId: string): Promise<ExtGoalStatus> {
    return this.request<ExtGoalStatus>("GET", `/goals/${goalId}`);
  }

  async listResourceCategories(): Promise<ResourceCategory[]> {
    return this.request<ResourceCategory[]>("GET", "/goals/resource-categories");
  }

  async listGoals(params?: {
    status?: string;
    claimStatus?: string;
    category?: string;
    metadata?: string[];
    assignedEmail?: string;
    inactiveDays?: number;
    limit?: number;
    offset?: number;
  }): Promise<ExtGoalListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.claimStatus) query.set("claimStatus", params.claimStatus);
    if (params?.category) query.set("category", params.category);
    if (params?.assignedEmail) query.set("assignedEmail", params.assignedEmail);
    if (params?.inactiveDays) query.set("inactiveDays", String(params.inactiveDays));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    // metadata is a repeatable param: metadata=track%3Dfrontend&metadata=cohort%3Dspring
    if (params?.metadata) {
      for (const tag of params.metadata) {
        query.append("metadata", tag);
      }
    }
    const qs = query.toString();
    return this.request<ExtGoalListResponse>(
      "GET",
      `/goals${qs ? `?${qs}` : ""}`
    );
  }

  async revokeClaim(claimToken: string): Promise<void> {
    await this.request<void>("DELETE", `/goals/claims/${claimToken}`);
  }

  async deleteGoal(goalId: string, hardDelete = false): Promise<void> {
    const qs = hardDelete ? "?hardDelete=true" : "";
    await this.request<void>("DELETE", `/goals/${goalId}${qs}`);
  }

  // Agent-assisted unfold (Tier 1 + 2)

  async unfoldGoal(params: {
    title: string;
    description?: string;
    context?: Record<string, unknown>;
    goalContext?: string;
    priority?: string;
    autoRespond?: boolean;
    clarificationAnswers?: Record<string, string>;
    createSubsteps?: boolean;
    suggestResources?: boolean;
    claimExpiresInDays?: number;
    progressShare?: boolean;
    metadata?: Record<string, string>;
    category?: string;
    resourceWorld?: Record<string, unknown>;
    assessment?: AssessmentInput;
    requestId?: string;
  }): Promise<ExtUnfoldResponse> {
    // Tier 1 (auto_respond=false) runs synchronous LLM work (40s backend budget);
    // Tier 2 (auto_respond=true) returns immediately after DB write.
    const timeout = (params.autoRespond ?? true) ? 10_000 : 45_000;
    return this.request<ExtUnfoldResponse>("POST", "/goals/unfold", {
      title: params.title,
      description: params.description,
      context: params.context,
      goalContext: params.goalContext || "professional",
      priority: params.priority || "medium",
      autoRespond: params.autoRespond ?? true,
      clarificationAnswers: params.clarificationAnswers,
      createSubsteps: params.createSubsteps ?? false,
      suggestResources: params.suggestResources ?? false,
      claimExpiresInDays: params.claimExpiresInDays || 30,
      progressShare: params.progressShare !== false
        ? { enabled: true }
        : undefined,
      metadata: params.metadata,
      category: params.category,
      resourceWorld: params.resourceWorld,
      assessment: params.assessment,
      requestId: params.requestId,
    }, timeout);
  }

  async submitClarification(
    goalId: string,
    params: {
      answers?: Record<string, string>;
      acceptAgentAnswers?: boolean;
    }
  ): Promise<ExtClarifySubmitResponse> {
    return this.request<ExtClarifySubmitResponse>(
      "POST",
      `/goals/${goalId}/clarify/submit-all`,
      {
        answers: params.answers || {},
        acceptAgentAnswers: params.acceptAgentAnswers ?? true,
      }
    );
  }

  // Tier 3: Passthrough import

  async getAnalytics(params?: {
    groupBy?: string;
    inactiveDays?: number;
    includeFunnel?: boolean;
    includeResources?: boolean;
    metadata?: Record<string, string>;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ExtAnalyticsResult> {
    const query = new URLSearchParams();
    if (params?.groupBy) query.set("groupBy", params.groupBy);
    if (params?.inactiveDays) query.set("inactiveDays", String(params.inactiveDays));
    if (params?.includeFunnel !== undefined) query.set("includeFunnel", String(params.includeFunnel));
    if (params?.includeResources !== undefined) query.set("includeResources", String(params.includeResources));
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);
    if (params?.metadata) {
      for (const [key, value] of Object.entries(params.metadata)) {
        query.append("metadata", `${key}=${value}`);
      }
    }
    const qs = query.toString();
    return this.request<ExtAnalyticsResult>("GET", `/analytics${qs ? `?${qs}` : ""}`);
  }

  async importPlan(params: {
    title: string;
    description?: string;
    steps: Array<{
      title: string;
      description?: string;
      substeps?: Array<{
        title: string;
        description?: string;
        type?: string;
      }>;
    }>;
    goalContext?: string;
    priority?: string;
    enrich?: boolean;
    enrichOptions?: {
      dependencies?: boolean;
      criticalPath?: boolean;
      durationEstimates?: boolean;
      severity?: boolean;
      complexity?: boolean;
      quickWins?: boolean;
      resources?: boolean;
    };
    claimExpiresInDays?: number;
    progressShare?: boolean;
  }): Promise<ExtImportResponse> {
    // enrich=true runs a synchronous LLM call (15s backend budget)
    const timeout = (params.enrich ?? true) ? 20_000 : 10_000;
    return this.request<ExtImportResponse>("POST", "/goals/import", {
      title: params.title,
      description: params.description,
      steps: params.steps,
      goalContext: params.goalContext || "professional",
      priority: params.priority || "medium",
      enrich: params.enrich ?? true,
      enrichOptions: params.enrichOptions,
      claimExpiresInDays: params.claimExpiresInDays || 30,
      progressShare: params.progressShare !== false
        ? { enabled: true }
        : undefined,
    }, timeout);
  }

  // Skill Assessment MCP tools

  async generateAssessment(params: {
    work_item_context: {
      title: string;
      description?: string;
      domain_tags?: string[];
    };
    skill: string;
    target_proficiency: string;
    num_questions: number;
    difficulty_mix?: Record<string, number>;
    band_thresholds?: Record<string, number[]>;
    language?: string;
    request_id: string;
  }): Promise<GenerateAssessmentResponse> {
    // 200s backend budget for generate + validate + retry pipeline
    return this.request<GenerateAssessmentResponse>(
      "POST",
      "/assessments/generate",
      params,
      210_000,
    );
  }

  async scoreAssessment(params: {
    assessment_token: string;
    answers: Array<{ question_id: string; selected_option_id: string }>;
    band_thresholds?: Record<string, number[]>;
    request_id: string;
  }): Promise<ScoreAssessmentResponse> {
    return this.request<ScoreAssessmentResponse>(
      "POST",
      "/assessments/score",
      params,
    );
  }

  async getAssessmentCapabilities(): Promise<AssessmentCapabilities> {
    return this.request<AssessmentCapabilities>(
      "GET",
      "/assessments/capabilities",
    );
  }
}
