import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnfoldClient } from "../client.js";

export function registerGetAnalytics(server: McpServer, client: UnfoldClient) {
  server.tool(
    "get_analytics",
    `Get aggregated analytics for your organization's goals.

Returns cohort KPIs (total, active, completed, blocked), claim metrics
(activation rate, time-to-claim), at-risk learners (inactive for N days),
an optional step-level completion funnel, and optional resource engagement
breakdown.

Use groupBy to break down completion rates by a metadata dimension
(e.g. groupBy="track" shows completion rates for frontend, backend, etc).

Use the metadata filter to narrow the scope to a specific cohort or
department (e.g. metadata={cohort: "spring-2026"}).

Examples:
- "How is the spring 2026 cohort doing?" ->
    get_analytics({ metadata: { cohort: "spring-2026" } })
- "Which track has the highest completion rate?" ->
    get_analytics({ groupBy: "track" })
- "How many students are at risk this week?" ->
    get_analytics({ inactiveDays: 7 })
- "Show me the step-by-step funnel for the frontend track" ->
    get_analytics({ metadata: { track: "frontend" }, includeFunnel: true })`,
    {
      group_by: z.string().optional()
        .describe("Metadata key to group completion rates by (e.g. 'track', 'cohort', 'department'). Returns a completionByDimension breakdown."),
      inactive_days: z.number().min(1).max(365).default(7)
        .describe("Goals with no step activity in this many days are flagged as at-risk. Default: 7."),
      include_funnel: z.boolean().default(true)
        .describe("Include the step-by-step completion funnel showing where learners drop off."),
      include_resources: z.boolean().default(false)
        .describe("Include resource engagement breakdown (video vs article, AI vs user-added)."),
      metadata: z.record(z.string()).optional()
        .describe("Filter to a specific cohort or segment by metadata tags (e.g. {cohort: 'spring-2026', track: 'frontend'})."),
      date_from: z.string().optional()
        .describe("ISO date (YYYY-MM-DD). Only include goals created on or after this date."),
      date_to: z.string().optional()
        .describe("ISO date (YYYY-MM-DD). Only include goals created on or before this date."),
    },
    async (params) => {
      try {
        const result = await client.getAnalytics({
          groupBy: params.group_by,
          inactiveDays: params.inactive_days,
          includeFunnel: params.include_funnel,
          includeResources: params.include_resources,
          metadata: params.metadata,
          dateFrom: params.date_from,
          dateTo: params.date_to,
        });

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
