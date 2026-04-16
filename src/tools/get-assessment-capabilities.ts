import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnfoldClient } from "../client.js";

export function registerGetAssessmentCapabilities(server: McpServer, client: UnfoldClient) {
  server.tool(
    "get_assessment_capabilities",
    `Get supported parameters for skill assessments.

Returns the schema version, supported languages, min/max question count,
proficiency bands, default band thresholds, default difficulty mix, and
whether the system is open-domain (accepts any skill) or restricted.

Use this to introspect before calling generate_skill_assessment. No
parameters required.

Requires the "assessment:read_capabilities" scope on your org API key.`,
    {},
    async () => {
      const result = await client.getAssessmentCapabilities();
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
