// Shared types for the Unfold MCP server

/**
 * Non-fatal warning surfaced on a successful response so callers can
 * self-correct without the request being rejected. Stable `code` strings
 * (snake_case) for deterministic agent branching. Known codes:
 *   - "category_assessment_type_mismatch" -- goal `category` and
 *     `assessment.assessment_type` disagree. Plan was generated using
 *     `assessment_type`; set category to match if you want category-aware
 *     resource routing to align.
 *   - "duplicate_assessment_input" -- both the structured `assessment`
 *     field and the legacy `additional_context.unfold_assessment`
 *     envelope were sent on the same request. Structured field wins;
 *     remove the legacy envelope to clean up.
 */
export interface ApiWarning {
  code: string;
  message: string;
}

export interface ExtGoalCreated {
  goalId: string;
  claimLink: string;
  claimToken: string;
  claimExpiresAt: string;
  progressLink: string | null;
  status: string;
  planGenerationStatus: string;
  warnings: ApiWarning[];
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
  warnings: ApiWarning[];
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

/**
 * One facet's aggregated correctness after server-side join with the
 * per-question facets shipped in the signed token. `classification` is
 * computed against thresholds documented in the backend; partners get
 * the same numbers across cohorts.
 */
export interface PerFacetResult {
  facet: string;
  total: number;
  correct: number;
  raw_pct: number;
  classification: "weak" | "strong" | "mixed";
}

export type FacetCoverage = "full" | "partial" | "difficulty_fallback";

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
  /**
   * Per-facet aggregation computed server-side. Ordered by descending
   * raw_pct (ties broken by facet name ascending) for stable rendering.
   */
  per_facet: PerFacetResult[];
  /**
   * Facet names classified "weak" (raw_pct < 50 with >= 2 questions).
   * Convenience projection of per_facet for callers that only want the
   * short list. Excludes the `_unfaceted` bucket so partners do not
   * surface it as a learning topic.
   */
  weak_facets: string[];
  strong_facets: string[];
  /**
   * Quality of the underlying facet labelling:
   *   - "full" -- every question had a real LLM-emitted skill_facet.
   *   - "partial" -- some questions used the difficulty:<level>
   *     synthetic fallback.
   *   - "difficulty_fallback" -- the whole aggregation is over
   *     difficulty buckets. Soften "weak in X" UI framing accordingly.
   */
  facet_coverage: FacetCoverage;
  recommended_action: string;
  suggested_goal_seed?: SuggestedGoalSeed | null;
}

// ===========================================================================
// Assessment input (the `assessment` field on create_goal)
// ===========================================================================

/**
 * The structured assessment input that ships on `create_goal`. A
 * discriminated union over `assessment_type`. Currently three variants:
 *
 * - `skill_proficiency` v1: scored skill assessment. Drop the response
 *   from `score_skill_assessment` straight in (plus assessment_type +
 *   schema_version + assessed_at headers and a couple of renames).
 *
 * - `clinical_intake` v1: schema reserved for ADHD / coaching /
 *   clinical contexts. Wire shape is locked; the backend prompt
 *   builder is currently a stub and will return
 *   `assessment_type_not_supported` until a real partner drives it.
 *   Build integrations now; switch on when the backend lands.
 *
 * - `general` v1: deliberately-weaker catch-all for assessment data
 *   that does not fit either typed shape. The planner treats input as
 *   supplementary hints, not hard constraints (except items under
 *   `constraints`, which are honoured as hard limits).
 *
 * Unknown extra fields inside each variant are ignored by the backend,
 * so partners running ahead of the server do not break.
 */
export type AssessmentInput =
  | SkillProficiencyAssessmentV1
  | ClinicalIntakeAssessmentV1
  | GeneralAssessmentV1;

export interface WorkItemContextV1 {
  title: string;
  description?: string;
}

export interface PerQuestionSummaryEntryV1 {
  facet?: string;
  difficulty?: string;
  correct?: boolean;
}

export interface SkillProficiencyAssessmentV1 {
  assessment_type: "skill_proficiency";
  schema_version: "v1";
  // Required
  skill: string;
  target_band: "beginner" | "low" | "medium" | "high";
  assessed_at: string; // ISO 8601
  // Optional but recommended
  achieved_band?: "beginner" | "low" | "medium" | "high";
  raw_pct?: number;
  gap_bands?: number;
  weak_facets?: string[];
  strong_facets?: string[];
  per_question_summary?: PerQuestionSummaryEntryV1[];
  work_item_context?: WorkItemContextV1;
  assessment_id?: string;
}

export interface SubjectProfileV1 {
  age?: number;
  age_band?: "child" | "teen" | "adult";
  self_identifies_as?: string;
}

export interface DiagnosisV1 {
  condition: string;
  diagnosed_at?: string;
  diagnosed_by?: string;
}

export interface ScreeningResultV1 {
  instrument: string;
  score?: number;
  interpretation?: string;
}

export interface ClinicalConstraintsV1 {
  medication?: string;
  comorbidities?: string[];
  accommodations_in_place?: string[];
}

export interface ClinicalIntakeAssessmentV1 {
  assessment_type: "clinical_intake";
  schema_version: "v1";
  // Required
  subject_profile: SubjectProfileV1;
  target_areas: string[];
  assessed_at: string;
  // Optional
  diagnoses?: DiagnosisV1[];
  screening_results?: ScreeningResultV1[];
  current_struggles?: string[];
  strengths?: string[];
  constraints?: ClinicalConstraintsV1;
  clinician_notes?: string;
  assessor_role?: "self" | "clinician" | "coach" | "parent";
}

export interface GeneralAssessmentV1 {
  assessment_type: "general";
  schema_version: "v1";
  // Required
  summary: string;
  assessed_at: string;
  // Optional structured signals (treated as soft hints by the planner)
  focus_areas?: string[];
  avoid_areas?: string[];
  // Items in `constraints` ARE honoured as hard limits in the general
  // builder, unlike the other soft hints.
  constraints?: string[];
  subject_profile?: Record<string, unknown>;
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
