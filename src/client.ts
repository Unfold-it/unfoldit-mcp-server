// REST client for the Unfold external API (/api/v1/ext/*)

import type {
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
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.unfoldit.com";
const DEFAULT_TIMEOUT_MS = parseInt(
  process.env.UNFOLD_MCP_REQUEST_TIMEOUT_MS || "30000",
  10
);

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
      let detail = "";
      try {
        const err = await res.json();
        detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err);
      } catch {
        detail = await res.text();
      }
      throw new Error(`Unfold API error (${res.status}): ${detail}`);
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
    });
  }

  async getGoalStatus(goalId: string): Promise<ExtGoalStatus> {
    return this.request<ExtGoalStatus>("GET", `/goals/${goalId}`);
  }

  async listGoals(params?: {
    status?: string;
    claimStatus?: string;
    metadata?: string[];
    assignedEmail?: string;
    inactiveDays?: number;
    limit?: number;
    offset?: number;
  }): Promise<ExtGoalListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.claimStatus) query.set("claimStatus", params.claimStatus);
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
