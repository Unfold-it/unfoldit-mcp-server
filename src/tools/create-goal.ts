import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AssessmentInput } from "../types.js";
import { UnfoldApiError, type UnfoldClient } from "../client.js";

// ---------------------------------------------------------------------------
// Assessment input schemas (v0.7.0): discriminated union over assessment_type.
// Mirrors app/schemas/assessment_input.py in the backend; extra unknown
// fields are ignored so partners running ahead of the server don't break.
// ---------------------------------------------------------------------------

const proficiencyBand = z.enum(["beginner", "low", "medium", "high"]);

const workItemContextV1 = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

const perQuestionSummaryEntryV1 = z.object({
  facet: z.string().optional(),
  difficulty: z.string().optional(),
  correct: z.boolean().optional(),
});

const skillProficiencyV1 = z.object({
  assessment_type: z.literal("skill_proficiency"),
  schema_version: z.literal("v1"),
  skill: z.string().min(1).max(120),
  target_band: proficiencyBand,
  assessed_at: z.string()
    .describe("ISO 8601 timestamp of when the assessment was scored"),
  achieved_band: proficiencyBand.optional(),
  raw_pct: z.number().min(0).max(100).optional(),
  gap_bands: z.number().int().min(0).optional(),
  weak_facets: z.array(z.string()).optional()
    .describe("Sub-skills the learner is weak on; planner prioritises these"),
  strong_facets: z.array(z.string()).optional()
    .describe("Sub-skills the learner is strong on; planner skips or compresses these"),
  per_question_summary: z.array(perQuestionSummaryEntryV1).optional(),
  work_item_context: workItemContextV1.optional()
    .describe("The work item this assessment was about. Strongly recommended; the planner grounds steps in it."),
  assessment_id: z.string().max(128).optional(),
});

const clinicalIntakeV1 = z.object({
  assessment_type: z.literal("clinical_intake"),
  schema_version: z.literal("v1"),
  subject_profile: z.object({
    age: z.number().int().min(0).max(150).optional(),
    age_band: z.enum(["child", "teen", "adult"]).optional(),
    self_identifies_as: z.string().max(120).optional(),
  }),
  target_areas: z.array(z.string()).min(1)
    .describe("Areas the plan should help with, e.g. ['morning routine', 'task initiation']"),
  assessed_at: z.string(),
  diagnoses: z.array(z.object({
    condition: z.string().min(1).max(120),
    diagnosed_at: z.string().max(64).optional(),
    diagnosed_by: z.string().max(120).optional(),
  })).optional(),
  screening_results: z.array(z.object({
    instrument: z.string().min(1).max(120),
    score: z.number().optional(),
    interpretation: z.string().max(255).optional(),
  })).optional(),
  current_struggles: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  constraints: z.object({
    medication: z.string().max(255).optional(),
    comorbidities: z.array(z.string()).optional(),
    accommodations_in_place: z.array(z.string()).optional(),
  }).optional(),
  clinician_notes: z.string().max(4000).optional(),
  assessor_role: z.enum(["self", "clinician", "coach", "parent"]).optional(),
});

const generalAssessmentV1 = z.object({
  assessment_type: z.literal("general"),
  schema_version: z.literal("v1"),
  summary: z.string().min(1).max(2000)
    .describe("Short prose describing what was assessed. Required so 'general' is not used as a bare passthrough."),
  assessed_at: z.string(),
  focus_areas: z.array(z.string()).optional()
    .describe("Hints for the planner to consider (soft, not hard rules)"),
  avoid_areas: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional()
    .describe("HARD limits the planner must honour (the only strong-bias signal in the general builder)"),
  subject_profile: z.record(z.unknown()).optional(),
});

const assessmentInputSchema = z.discriminatedUnion("assessment_type", [
  skillProficiencyV1,
  clinicalIntakeV1,
  generalAssessmentV1,
]);

export function registerCreateGoal(server: McpServer, client: UnfoldClient) {
  server.tool(
    "create_goal",
    `Create a goal in your Unfold org with an AI-generated plan.

Returns a one-time claim link to send to the user. When they click it,
they auto-join your org, get assigned the goal, and land directly on it
with a fully AI-generated plan ready to execute.

The plan generates asynchronously (15-30s). The claim link works immediately.
Use get_goal_status to check when planGenerationStatus changes to "completed".

With auto_respond=true (default), the agent answers all clarification questions
automatically using the provided context. Set auto_respond=false to get
questions back with agent suggestions for client review -- then use
submit_clarification to provide your answers.

CHAINING:
  - If you have an assessment scored via score_skill_assessment, drop its
    response (band, target_band, per_facet, weak_facets, work_item_context)
    into the 'assessment' field. The planner will prioritise weak facets,
    skip strong ones, and anchor steps in the work item.
  - Each goal is for one user. Call this once per learner/user.

TYPED ERRORS (branch on error_code):
  - "models_not_configured": tenant's BYO provider has no role configured.
    Response includes settings_url for the user to fix it.
  - "provider_unauthorized" / "provider_quota_exceeded": BYO provider key
    rejected. Response may include switch_to_unfold_ai CTA.
  - "assessment_type_not_supported": you sent an assessment whose prompt
    builder is not yet wired (e.g. clinical_intake before partner
    integration). Response.details.supported lists what IS wired.

WARNINGS (non-fatal, surfaced in response.warnings):
  - "category_assessment_type_mismatch": category and assessment_type
    disagree (e.g. learning + clinical_intake). The plan was generated
    using assessment_type. Set category to align if you want category-aware
    resource routing.
  - "duplicate_assessment_input": you sent both the structured 'assessment'
    field and the legacy unfold_assessment envelope inside additional_context.
    Structured wins.`,
    {
      title: z.string().describe("Goal title, e.g. 'AI Fundamentals Learning Path'"),
      description: z.string().optional()
        .describe("Goal description with context. More detail produces a better AI plan."),
      context: z.object({
        tech_stack: z.array(z.string()).optional().describe("e.g. ['Python', 'React']"),
        team_size: z.number().optional(),
        timeline: z.string().optional().describe("e.g. '3 months', 'Q3 2026'"),
        constraints: z.string().optional().describe("e.g. 'limited budget', '2 hours per week'"),
        resources: z.string().optional().describe("e.g. 'team of 3', 'solo learner'"),
        success_criteria: z.string().optional().describe("e.g. 'pass certification exam'"),
        experience_level: z.string().optional().describe("e.g. 'beginner', 'intermediate', 'advanced'"),
        industry: z.string().optional(),
        additional_notes: z.string().optional(),
      }).optional().describe("Structured context the planner honours directly (not paraphrased via clarification). Higher-priority than free-form description."),
      auto_respond: z.boolean().default(true)
        .describe("true = fully autonomous (agent answers all questions). false = returns questions with suggestions for review."),
      clarification_answers: z.record(z.string()).optional()
        .describe("Pre-set answers by question ID. Agent skips these questions."),
      goal_context: z.enum(["personal", "professional"]).default("professional"),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      claim_expires_in_days: z.number().min(1).max(365).default(30)
        .describe("How many days the claim link stays valid"),
      progress_share: z.boolean().default(true)
        .describe("Generate an embeddable progress report link"),
      metadata: z.record(z.string()).optional()
        .describe("Custom key-value tags for filtering and analytics (e.g. {cohort: 'spring-2026', track: 'frontend', department: 'engineering'}). Used in get_analytics to group and filter results."),
      category: z.enum(["learning", "health_adhd", "general"]).optional()
        .describe("Goal category for resource routing. Auto-detected from title if omitted. 'learning' = technical skills, courses, upskilling. 'health_adhd' = ADHD management, executive function, habit building. 'general' = everything else. If you also pass `assessment`, prefer the matching category (learning <-> skill_proficiency, health_adhd <-> clinical_intake) to avoid the category_assessment_type_mismatch warning."),
      resource_world: z.object({
        preferred_sources: z.array(z.string()).optional()
          .describe("Domain names to prefer for resources, e.g. ['docs.anthropic.com', 'udemy.com']"),
        excluded_sources: z.array(z.string()).optional()
          .describe("Domain names to exclude from resource results"),
        youtube_playlists: z.array(z.string()).optional()
          .describe("YouTube playlist URLs to search first for resources"),
        lms_search_endpoint: z.string().optional()
          .describe("Custom LMS search API endpoint URL"),
        content_policies: z.object({
          prefer_video_ratio: z.number().min(0).max(1).optional()
            .describe("0.0-1.0, how much to prefer video resources"),
          max_resources_per_step: z.number().min(1).max(10).optional(),
          certification_preferred: z.boolean().optional(),
        }).optional(),
      }).optional()
        .describe("Per-goal resource config. Overrides org defaults for this goal's resource discovery."),
      assessment: assessmentInputSchema.optional()
        .describe(
          "Structured assessment input. Discriminated by assessment_type:\n" +
          "- skill_proficiency v1: drop the score_skill_assessment response directly here. The planner uses band/target_band/weak_facets/strong_facets/work_item_context for a targeted plan.\n" +
          "- clinical_intake v1: ADHD/coaching/clinical context. Wire shape is locked; the prompt builder is not yet wired (you will get assessment_type_not_supported until a real partner drives it).\n" +
          "- general v1: catch-all for assessment data that does not fit either typed shape. Treated as soft hints; `constraints` are the only hard limits.",
        ),
      request_id: z.string().max(128).optional()
        .describe(
          "Idempotency key. Within a 5-minute window, two calls with the same " +
          "request_id return the SAME goal and claim link instead of creating " +
          "a new one. MUST be unique per logical operation (per learner / per " +
          "enrollment). Two different learners with identical title/description/" +
          "assessment MUST use different keys -- if you reuse a key across " +
          "learners, the second learner receives a claim link the first " +
          "learner already claimed. Recommended construction: derive from your " +
          "own enrollment_id, or `${course_id}:${learner_id}`. Omit to get a " +
          "fresh goal on every call (the default). On a replay, the response's " +
          "`idempotentReplay` is true and `claimStatus` reflects current DB " +
          "truth so you can detect a link that was already consumed.",
        ),
    },
    async (params) => {
      try {
        const result = await client.unfoldGoal({
          title: params.title,
          description: params.description,
          context: params.context as Record<string, unknown> | undefined,
          goalContext: params.goal_context,
          priority: params.priority,
          autoRespond: params.auto_respond,
          clarificationAnswers: params.clarification_answers,
          claimExpiresInDays: params.claim_expires_in_days,
          progressShare: params.progress_share,
          metadata: params.metadata,
          category: params.category,
          resourceWorld: params.resource_world,
          assessment: params.assessment as AssessmentInput | undefined,
          requestId: params.request_id,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (err) {
        if (err instanceof UnfoldApiError) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(err.toPayload(), null, 2) }],
            isError: true,
          };
        }
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
