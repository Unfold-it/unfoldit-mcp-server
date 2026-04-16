#!/usr/bin/env node

/**
 * Unfold MCP Server
 *
 * Connects AI assistants to Unfold -- create goals with AI-generated plans,
 * distribute claim links, and track learner progress.
 *
 * Configuration via environment variables:
 *   UNFOLD_API_KEY  (required) - Org-scoped API key from app.unfoldit.com/organization
 *   UNFOLD_API_URL  (optional) - API base URL (defaults to https://api.unfoldit.com)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { UnfoldClient } from "./client.js";
import { registerCreateGoal } from "./tools/create-goal.js";
import { registerGetGoalStatus } from "./tools/get-goal-status.js";
import { registerListGoals } from "./tools/list-goals.js";
import { registerRevokeClaim } from "./tools/revoke-claim.js";
import { registerGetClarification } from "./tools/get-clarification.js";
import { registerSubmitClarification } from "./tools/submit-clarification.js";
import { registerImportPlan } from "./tools/import-plan.js";
import { registerGetAnalytics } from "./tools/get-analytics.js";
import { registerGenerateAssessment } from "./tools/generate-assessment.js";
import { registerScoreAssessment } from "./tools/score-assessment.js";
import { registerGetAssessmentCapabilities } from "./tools/get-assessment-capabilities.js";

// Read configuration from environment
const apiKey = process.env.UNFOLD_API_KEY;
const apiUrl = process.env.UNFOLD_API_URL;

if (!apiKey) {
  console.error(
    "Error: UNFOLD_API_KEY environment variable is required.\n" +
    "Generate one at: app.unfoldit.com -> Organization -> API Keys"
  );
  process.exit(1);
}

// Initialize client and server
const client = new UnfoldClient(apiKey, apiUrl);

const server = new McpServer({
  name: "unfold",
  version: "0.1.0",
});

// Register all tools
registerCreateGoal(server, client);
registerGetGoalStatus(server, client);
registerListGoals(server, client);
registerRevokeClaim(server, client);
registerGetClarification(server, client);
registerSubmitClarification(server, client);
registerImportPlan(server, client);
registerGetAnalytics(server, client);
registerGenerateAssessment(server, client);
registerScoreAssessment(server, client);
registerGetAssessmentCapabilities(server, client);

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start Unfold MCP server:", err);
  process.exit(1);
});
