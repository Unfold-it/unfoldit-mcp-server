import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnfoldClient } from "../client.js";

export function registerGenerateAssessment(server: McpServer, client: UnfoldClient) {
  server.tool(
    "generate_skill_assessment",
    `Generate a skill-proficiency assessment (MCQs) for a learner.

You provide a skill, target proficiency, number of questions, and the work
item the learner is preparing for. Unfold returns the questions with
multiple-choice options, a signed assessment_token, and a proficiency band
map. The learner answers in your UI; then call score_skill_assessment with
the token and answers.

Questions are AI-generated and validated (structural + semantic) before
being returned. The assessment_token is HMAC-signed and tamper-proof; it
contains the answer key so scoring is stateless and deterministic.

Requires the "assessment:generate" scope on your org API key.`,
    {
      work_item_context: z.object({
        title: z.string().describe("Title of the work item the learner needs the skill for"),
        description: z.string().optional().describe("Description of the work item (max 2000 chars)"),
        domain_tags: z.array(z.string()).optional().describe("Domain tags for question anchoring"),
      }).describe("The work item context to anchor question relevance"),
      skill: z.string().describe("Skill to assess (e.g. 'Python', 'SQL', 'Project Management')"),
      target_proficiency: z.enum(["beginner", "low", "medium", "high"]).describe("Proficiency band the learner should reach"),
      num_questions: z.number().int().min(3).max(20).describe("Number of MCQs to generate (3-20)"),
      difficulty_mix: z.record(z.number()).optional().describe("Difficulty distribution as {easy, medium, hard} floats summing to 1.0. Defaults to {easy: 0.2, medium: 0.5, hard: 0.3}"),
      band_thresholds: z.record(z.array(z.number())).optional().describe("Custom proficiency band ranges. Defaults: beginner [0,10], low [11,50], medium [51,85], high [86,100]"),
      language: z.string().optional().describe("ISO language code (default 'en')"),
      request_id: z.string().describe("Client-supplied idempotency key. Same request_id returns the same assessment."),
    },
    async (params) => {
      const result = await client.generateAssessment({
        work_item_context: {
          title: params.work_item_context.title,
          description: params.work_item_context.description,
          domain_tags: params.work_item_context.domain_tags,
        },
        skill: params.skill,
        target_proficiency: params.target_proficiency,
        num_questions: params.num_questions,
        difficulty_mix: params.difficulty_mix,
        band_thresholds: params.band_thresholds,
        language: params.language,
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
