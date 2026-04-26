import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnfoldClient } from "../client.js";

export function registerGetGoalStatus(server: McpServer, client: UnfoldClient) {
  server.tool(
    "get_goal_status",
    `Get the current status and progress of a goal.

Returns who claimed it, step completion breakdown, plan generation status,
and the embeddable progress report link.

Use this to check if plan generation is complete (planGenerationStatus: "completed")
or to monitor a learner's progress.`,
    {
      goal_id: z.string().describe("The goal ID returned from create_goal"),
    },
    async (params) => {
      try {
        const result = await client.getGoalStatus(params.goal_id);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
