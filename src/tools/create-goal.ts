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

With auto_respond=true (default), the agent answers all clarification questions
automatically using the provided context and user history. Set auto_respond=false
to get questions back with agent suggestions for client review -- then use
submit_clarification to provide your answers.

Each goal is for one user. Call this once per learner/user.`,
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
      }).optional().describe("Context for the agent to answer clarification questions. More context = better plan."),
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
    },
    async (params) => {
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
