// REST client for the Unfold external API (/api/v1/ext/*)

import type {
  ExtGoalCreated,
  ExtGoalStatus,
  ExtGoalListResponse,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.unfoldit.com";

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
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1/ext${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
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
    });
  }

  async getGoalStatus(goalId: string): Promise<ExtGoalStatus> {
    return this.request<ExtGoalStatus>("GET", `/goals/${goalId}`);
  }

  async listGoals(params?: {
    status?: string;
    claimStatus?: string;
    limit?: number;
    offset?: number;
  }): Promise<ExtGoalListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.claimStatus) query.set("claimStatus", params.claimStatus);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.request<ExtGoalListResponse>(
      "GET",
      `/goals${qs ? `?${qs}` : ""}`
    );
  }

  async revokeClaim(claimToken: string): Promise<void> {
    await this.request<void>("DELETE", `/goals/claims/${claimToken}`);
  }
}
