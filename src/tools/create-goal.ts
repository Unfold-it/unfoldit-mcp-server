import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnfoldClient } from "../client.js";

export function registerCreateGoal(server: McpServer, client: UnfoldClient) {
  server.tool(
    "create_goal",
    `Create a goal in your Unfold org with AI-generated plan and steps.

Returns a one-time claim link to send to the user. When they click it,
they auto-join your org, get assigned the goal, and land directly on it
with a fully AI-generated plan ready to execute.

The plan generates asynchronously (15-30s). The claim link works immediately.
Use get_goal_status to check when planGenerationStatus changes to "completed".

Each goal is for one user. Call this once per learner/user.`,
    {
      title: z.string().describe("Goal title, e.g. 'AI Fundamentals Learning Path'"),
      description: z.string().optional()
        .describe("Goal description with context. More detail produces a better AI plan."),
      additional_context: z.string().optional()
        .describe("Extra context for plan generation (e.g. suggested topics, learning objectives, step hints)"),
      clarification_context: z.object({
        experience_level: z.string().optional().describe("e.g. 'beginner', 'intermediate', 'advanced'"),
        timeline: z.string().optional().describe("e.g. '3 months', '2 weeks'"),
        constraints: z.string().optional().describe("e.g. 'limited budget', '2 hours per week'"),
        resources: z.string().optional().describe("e.g. 'team of 3', 'solo learner'"),
        success_criteria: z.string().optional().describe("e.g. 'pass certification exam', 'complete project'"),
      }).optional().describe("Context for auto-answering clarification questions. Helps generate a more relevant plan."),
      context: z.enum(["personal", "professional"]).default("professional"),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      claim_expires_in_days: z.number().min(1).max(365).default(30)
        .describe("How many days the claim link stays valid"),
      progress_share: z.boolean().default(true)
        .describe("Generate an embeddable progress report link"),
    },
    async (params) => {
      const result = await client.createGoal({
        title: params.title,
        description: params.description,
        additionalContext: params.additional_context,
        clarificationContext: params.clarification_context ? {
          experienceLevel: params.clarification_context.experience_level,
          timeline: params.clarification_context.timeline,
          constraints: params.clarification_context.constraints,
          resources: params.clarification_context.resources,
          successCriteria: params.clarification_context.success_criteria,
        } : undefined,
        context: params.context,
        priority: params.priority,
        claimExpiresInDays: params.claim_expires_in_days,
        progressShare: params.progress_share,
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
