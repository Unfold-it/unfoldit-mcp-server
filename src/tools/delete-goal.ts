import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnfoldApiError, type UnfoldClient } from "../client.js";

export function registerDeleteGoal(server: McpServer, client: UnfoldClient) {
  server.tool(
    "delete_goal",
    `Delete a goal created via the API.

Use this when regenerating a goal after a learner retakes a skill
assessment: call create_goal with the new suggested_goal_seed, then call
delete_goal on the obsolete goal so the learner's dashboard shows the
current goal instead of duplicates.

Soft delete by default (status='deleted'); the dashboard already filters
these out, but a superadmin can restore them. Set hard_delete=true to
permanently remove the row and cascade to steps, plans, and share links.

Scoped to api-created goals in your org -- you cannot delete goals a
user created in the webapp UI. Calling twice with the same goal_id is
safe (soft delete is idempotent).`,
    {
      goal_id: z.string().describe("The UUID of the goal to delete (the goalId returned by create_goal)"),
      hard_delete: z.boolean().optional().default(false)
        .describe("If true, permanently delete the row instead of soft-deleting. Default false."),
    },
    async (params) => {
      try {
        await client.deleteGoal(params.goal_id, params.hard_delete);
        return {
          content: [{
            type: "text" as const,
            text: params.hard_delete
              ? "Goal permanently deleted."
              : "Goal deleted (soft delete -- the row is preserved with status='deleted').",
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
