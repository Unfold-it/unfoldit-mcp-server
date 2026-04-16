import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnfoldClient } from "../client.js";

export function registerScoreAssessment(server: McpServer, client: UnfoldClient) {
  server.tool(
    "score_skill_assessment",
    `Score a skill assessment using answers and the assessment_token from
generate_skill_assessment.

Returns the raw score, percentage, proficiency band, gap vs target, and
per-question results. When the learner falls short of the target band,
includes a suggested_goal_seed you can pass to create_goal to spin up a
personalized learning path.

Scoring is stateless and deterministic: the signed assessment_token
contains the answer key. Tampered or expired tokens are rejected. Same
request_id returns the same result (idempotent).

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
    }
  );
}
