import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnfoldApiError, type UnfoldClient } from "../client.js";

export function registerGetClarification(server: McpServer, client: UnfoldClient) {
  server.tool(
    "get_clarification",
    `Get pending clarification questions for a goal with agent-suggested answers.

Use this after create_goal with auto_respond=false. Returns the list of
clarification questions along with what the agent suggested for each one,
including confidence levels and reasoning.

Review the suggestions, then use submit_clarification to accept or override them.`,
    {
      goal_id: z.string().describe("The goal ID returned from create_goal"),
    },
    async (params) => {
      try {
        // The unfold response already contains questions when auto_respond=false.
        // For polling, we use get_goal_status which now includes agent_answers.
        // But the primary flow is: create_goal(auto_respond=false) returns questions directly.
        // This tool re-fetches via the status endpoint for cases where the client
        // lost the original response.
        const result = await client.getGoalStatus(params.goal_id);

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
