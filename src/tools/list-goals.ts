import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnfoldApiError, type UnfoldClient } from "../client.js";

export function registerListGoals(server: McpServer, client: UnfoldClient) {
  server.tool(
    "list_goals",
    `List all goals in your org created via the API.

Filter by goal status (draft, in_progress, completed), claim status
(unclaimed, claimed, expired, revoked), metadata tags, assigned learner
email, or inactivity (at-risk detection).

Use this to see all learner goals, check progress across a cohort,
find unused claim links, or identify learners who have gone inactive.

For aggregate cohort metrics, use get_analytics instead.`,
    {
      status: z.enum(["draft", "in_progress", "completed", "blocked", "paused"])
        .optional().describe("Filter by goal status"),
      claim_status: z.enum(["unclaimed", "claimed", "expired", "revoked"])
        .optional().describe("Filter by claim link status"),
      category: z.enum(["learning", "health_adhd", "general"])
        .optional().describe("Filter by resource category. Use this to segment ADHD goals from learning goals."),
      metadata: z.array(z.string()).optional()
        .describe("Filter by metadata tag(s) in 'key=value' format. Repeatable for AND logic. E.g. ['track=frontend', 'cohort=spring-2026']"),
      assigned_email: z.string().email().optional()
        .describe("Return only the goal assigned to this learner email address"),
      inactive_days: z.number().min(1).max(365).optional()
        .describe("Return only goals with no step activity in the last N days (at-risk detection)"),
      limit: z.number().min(1).max(100).default(50).describe("Max results to return"),
      offset: z.number().min(0).default(0).describe("Pagination offset"),
    },
    async (params) => {
      try {
        const result = await client.listGoals({
          status: params.status,
          claimStatus: params.claim_status,
          category: params.category,
          metadata: params.metadata,
          assignedEmail: params.assigned_email,
          inactiveDays: params.inactive_days,
          limit: params.limit,
          offset: params.offset,
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
