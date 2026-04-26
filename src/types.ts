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

export interface ExtStepStatus {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  durationEstimate?: string | null;
  timeSpentSeconds: number;
  complexity?: string | null;
  priority?: string | null;
  isCriticalPath: boolean;
  isQuickWin: boolean;
  blockerCount: number;
  resourceCount: number;
  substepCount: number;
  substepCompletedCount: number;
}

export interface ExtGoalStatus {
  goalId: string;
  title: string;
  status: string;
  planGenerationStatus: string;
  assignedTo: ExtUser | null;
  claimStatus: string;
  claimCreatedAt: string | null;
  claimedAt: string | null;
  progress: ExtProgress;
  progressLink: string | null;
  lastActivityAt: string | null;
  resourceCategory?: string | null;
  metadata?: Record<string, string> | null;
  steps?: ExtStepStatus[] | null;
}

export interface ResourceCategory {
  id: string;
  name: string;
  description: string;
  activeProviders: string[];
  showDisclaimer: boolean;
  disclaimerText: string | null;
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

// Skill Assessment types

export interface AssessmentOption {
  id: string;
  text: string;
}

export interface AssessmentQuestion {
  id: string;
  stem: string;
  options: AssessmentOption[];
  score_weight: number;
  difficulty: string;
  skill_facet?: string | null;
}

export interface AssessmentModelMeta {
  provider: string;
  model_id: string;
  generated_at: string;
  validator_passes: string[];
  warnings: string[];
}

export interface GenerateAssessmentResponse {
  assessment_token: string;
  questions: AssessmentQuestion[];
  band_map: Record<string, number[]>;
  max_raw_score: number;
  target_band: string;
  model_meta: AssessmentModelMeta;
}

export interface PerQuestionResult {
  question_id: string;
  correct: boolean;
  awarded: number;
}

export interface SuggestedGoalSeed {
  title: string;
  summary: string;
  skill_focus: string;
  target_proficiency: string;
}

export interface ScoreAssessmentResponse {
  raw_score: number;
  max_raw_score: number;
  raw_pct: number;
  band: string;
  target_band: string;
  gap_bands: number;
  per_question: PerQuestionResult[];
  recommended_action: string;
  suggested_goal_seed?: SuggestedGoalSeed | null;
}

export interface AssessmentCapabilities {
  schema_version: string;
  supported_languages: string[];
  min_questions: number;
  max_questions: number;
  supported_proficiency_bands: string[];
  default_band_thresholds: Record<string, number[]>;
  default_difficulty_mix: Record<string, number>;
  open_domain: boolean;
  token_ttl_seconds: number;
}

// Analytics types

export interface AtRiskGoal {
  goalId: string;
  title: string;
  metadata?: Record<string, string> | null;
  daysInactive: number;
  progressPercent: number;
}

export interface DimensionCompletion {
  dimension: string;
  total: number;
  completed: number;
  completionRate: number;
}

export interface FunnelStep {
  stepOrder: number;
  stepTitle: string;
  totalGoals: number;
  completed: number;
  completionRate: number;
  avgHoursToComplete?: number | null;
}

export interface ResourceEngagement {
  resourceType: string;
  addedBy: string;
  total: number;
  completed: number;
  engagementRate: number;
}

export interface ExtAnalyticsResult {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  blockedGoals: number;
  completionRate: number;
  avgDaysToComplete?: number | null;
  claimsTotal: number;
  claimsClaimed: number;
  claimsPending: number;
  claimsExpired: number;
  avgHoursToClaim?: number | null;
  atRiskCount: number;
  atRiskGoals: AtRiskGoal[];
  inactiveThresholdDays: number;
  completionByDimension?: DimensionCompletion[] | null;
  stepFunnel?: FunnelStep[] | null;
  resourceEngagement?: ResourceEngagement[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  metadataFilters?: Record<string, string> | null;
}
