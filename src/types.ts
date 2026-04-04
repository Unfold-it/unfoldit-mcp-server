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

// Agent-assisted unfold (Tier 1 + 2)

export interface AgentAnswerDetail {
  questionId: string;
  questionText: string;
  answer: string;
  confidence: string;
  source: string;
  sourceType: string;
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  type: string;
  options?: string[];
  multiSelect?: boolean;
  defaultAssumption?: string;
  agentAnswer?: string;
  agentConfidence?: string;
  agentSource?: string;
}

export interface ExtUnfoldResponse {
  goalId: string;
  sessionId?: string;
  status: string;
  planGenerationStatus: string;
  questions?: ClarificationQuestion[];
  agentAnswersUsed?: AgentAnswerDetail[];
  claimLink?: string;
  claimToken?: string;
  claimExpiresAt?: string;
  progressLink?: string;
}

export interface ExtClarifySubmitResponse {
  goalId: string;
  status: string;
  planGenerationStatus: string;
  agentAnswersUsed?: AgentAnswerDetail[];
}

// Tier 3: Passthrough import

export interface EnrichedStep {
  title: string;
  description?: string;
  order: number;
  dependencies?: string[];
  isCriticalPath?: boolean;
  severity?: string;
  duration?: string;
  complexity?: string;
  isQuickWin?: boolean;
  substeps?: unknown[];
}

export interface ExtImportResponse {
  goalId: string;
  planId?: string;
  status: string;
  planGenerationStatus: string;
  steps?: EnrichedStep[];
  claimLink?: string;
  claimToken?: string;
  claimExpiresAt?: string;
  progressLink?: string;
}
