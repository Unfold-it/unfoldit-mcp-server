import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnfoldApiError, type UnfoldClient } from "../client.js";

export function registerSubmitClarification(server: McpServer, client: UnfoldClient) {
  server.tool(
    "submit_clarification",
    `Submit answers to clarification questions and trigger plan generation.

Use after create_goal with auto_respond=false. Provide your own answers for
questions you want to override. Set accept_agent_answers=true (default) to keep
the agent's suggestions for all questions you did not explicitly answer.

After submission, the plan generates asynchronously. Use get_goal_status to
check when planGenerationStatus changes to "completed".`,
    {
      goal_id: z.string().describe("The goal ID from create_goal"),
      answers: z.record(z.string()).optional()
        .describe("Your answers keyed by question ID. Only include questions you want to override."),
      accept_agent_answers: z.boolean().default(true)
        .describe("Accept agent-suggested answers for questions not in your answers."),
    },
    async (params) => {
      try {
        const result = await client.submitClarification(params.goal_id, {
          answers: params.answers,
          acceptAgentAnswers: params.accept_agent_answers,
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
