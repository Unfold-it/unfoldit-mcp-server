import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnfoldApiError, type UnfoldClient } from "../client.js";

export function registerScoreAssessment(server: McpServer, client: UnfoldClient) {
  server.tool(
    "score_skill_assessment",
    `Score a skill assessment using answers and the assessment_token from
generate_skill_assessment.

Returns the raw score, percentage, proficiency band, gap vs target, and
per-question results. When the learner falls short of the target band,
includes a suggested_goal_seed you can pass to create_goal.

PER-FACET AGGREGATION (since v0.7.0):
Response also includes per_facet (one entry per sub-skill with total,
correct, raw_pct, classification) and shortlists weak_facets +
strong_facets. Aggregation is computed server-side from facets embedded
in the signed token, so partners do not write join logic. The
facet_coverage field tells you whether facet labels are real ("full"),
partially synthetic ("partial"), or entirely difficulty-bucket
fallbacks ("difficulty_fallback") -- soften "weak in X" UI framing when
coverage is not "full".

CHAINING into create_goal:
The shape of this response is purpose-built to drop straight into
create_goal's 'assessment' field (as a skill_proficiency v1 variant):
  - band -> achieved_band
  - target_band -> target_band
  - raw_pct, gap_bands -> same names
  - weak_facets, strong_facets -> same names
  - work_item_context comes from your original generate_skill_assessment call
Add assessment_type: "skill_proficiency", schema_version: "v1", and
assessed_at (ISO 8601 current time) headers.

Scoring is stateless and deterministic: the signed assessment_token
contains the answer key. Tampered or expired tokens are rejected. Same
request_id returns the same result (idempotent).

TYPED ERRORS (branch on error_code):
  - "token_invalid": signature mismatch or malformed token. Regenerate
    via generate_skill_assessment.
  - "assessment_expired": token past TTL. Regenerate.
  - "idempotency_conflict": same request_id was used with different
    answers; pick a new request_id.

Requires the "assessment:score" scope on your org API key.`,
    {
      assessment_token: z.string().describe("The signed token from generate_skill_assessment"),
      answers: z.array(z.object({
        question_id: z.string().describe("Question ID from the generated assessment"),
        selected_option_id: z.string().describe("The option ID the learner selected"),
      })).min(1).describe("Learner's answers (at least one)"),
      band_thresholds: z.record(z.array(z.number())).optional().describe("Optional override of proficiency band ranges (defaults to the thresholds embedded in the token)"),
      request_id: z.string().describe("Client-supplied idempotency key"),
    },
    async (params) => {
      try {
        const result = await client.scoreAssessment({
          assessment_token: params.assessment_token,
          answers: params.answers,
          band_thresholds: params.band_thresholds,
          request_id: params.request_id,
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
