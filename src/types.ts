// Shared types for the Unfold MCP server

export interface ExtGoalCreated {
  goalId: string;
  claimLink: string;
  claimToken: string;
  claimExpiresAt: string;
  progressLink: string | null;
  status: string;
  planGenerationStatus: string;
}

export interface ExtUser {
  email: string | null;
  fullName: string | null;
}

export interface ExtProgress {
  overallPercent: number;
  totalSteps: number;
  completedSteps: number;
  inProgressSteps: number;
  blockedSteps: number;
}

export interface ExtGoalStatus {
  goalId: string;
  title: string;
  status: string;
  planGenerationStatus: string;
  assignedTo: ExtUser | null;
  claimStatus: string;
  claimedAt: string | null;
  progress: ExtProgress;
  progressLink: string | null;
  lastActivityAt: string | null;
}

export interface ExtGoalListResponse {
  goals: ExtGoalStatus[];
  total: number;
}
