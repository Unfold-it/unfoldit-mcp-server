import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnfoldClient } from "../client.js";

export function registerListGoals(server: McpServer, client: UnfoldClient) {
  server.tool(
    "list_goals",
    `List all goals in your org created via the API.

Filter by goal status (draft, in_progress, completed) or claim status
(unclaimed, claimed, expired, revoked).

Use this to see all learner goals, check progress across a cohort,
or find unused claim links.`,
    {
      status: z.enum(["draft", "in_progress", "completed", "blocked", "paused"])
        .optional().describe("Filter by goal status"),
      claim_status: z.enum(["unclaimed", "claimed", "expired", "revoked"])
        .optional().describe("Filter by claim link status"),
      limit: z.number().min(1).max(100).default(50).describe("Max results to return"),
      offset: z.number().min(0).default(0).describe("Pagination offset"),
    },
    async (params) => {
      const result = await client.listGoals({
        status: params.status,
        claimStatus: params.claim_status,
        limit: params.limit,
        offset: params.offset,
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
