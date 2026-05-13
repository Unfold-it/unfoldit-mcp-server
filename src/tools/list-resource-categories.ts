import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnfoldApiError, type UnfoldClient } from "../client.js";

export function registerListResourceCategories(server: McpServer, client: UnfoldClient) {
  server.tool(
    "list_resource_categories",
    `List available resource categories for goal classification.

Returns the categories you can use in create_goal's \`category\` field or
as a filter in list_goals. Each category has different resource providers,
content safety policies, and plan generation behavior.

For example, "health_adhd" restricts resources to curated clinical sources,
excludes medication content, adds disclaimers, and generates shorter substeps
with transition rituals. "learning" adds YouTube, GitHub, and Official Docs
providers alongside web search.

Use this to build adaptive UIs that show category-specific options to your users.`,
    {},
    async () => {
      try {
        const categories = await client.listResourceCategories();
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(categories, null, 2),
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
