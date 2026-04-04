import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnfoldClient } from "../client.js";

export function registerImportPlan(server: McpServer, client: UnfoldClient) {
  server.tool(
    "import_plan",
    `Import a pre-formulated plan with steps and substeps into Unfold.

Skips clarification entirely. Use this when you already have a structured plan
(e.g. from Jira, Linear, or your own planning tool).

Optionally enriches steps with AI-generated metadata: dependencies between steps,
critical path identification, duration estimates, severity/complexity ratings,
and quick-win flags. Set enrich=false to skip AI enrichment (0 credits).

Returns the goal with a claim link and the enriched step list.`,
    {
      title: z.string().min(1).max(255).describe("Goal title"),
      description: z.string().max(5000).optional().describe("Goal description"),
      steps: z.array(z.object({
        title: z.string().min(1).max(255).describe("Step title"),
        description: z.string().optional().describe("Step description"),
        substeps: z.array(z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          type: z.enum(["research", "work", "decision", "verification"]).default("work"),
        })).optional().describe("Optional substeps within this step"),
      })).min(1).max(50).describe("List of steps in execution order"),
      enrich: z.boolean().default(true)
        .describe("Run AI enrichment to add dependencies, durations, severity, complexity, critical path, quick wins."),
      enrich_options: z.object({
        dependencies: z.boolean().default(true).describe("Detect step dependencies"),
        critical_path: z.boolean().default(true).describe("Identify critical path"),
        duration_estimates: z.boolean().default(true).describe("Estimate step durations"),
        severity: z.boolean().default(true).describe("Rate step severity"),
        complexity: z.boolean().default(true).describe("Rate step complexity"),
        quick_wins: z.boolean().default(true).describe("Flag quick-win steps"),
        resources: z.boolean().default(false).describe("Suggest resources per step (adds latency)"),
      }).optional().describe("Control which enrichment features to run"),
      goal_context: z.enum(["personal", "professional"]).default("professional"),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      claim_expires_in_days: z.number().min(1).max(365).default(30),
      progress_share: z.boolean().default(true),
    },
    async (params) => {
      const result = await client.importPlan({
        title: params.title,
        description: params.description,
        steps: params.steps,
        goalContext: params.goal_context,
        priority: params.priority,
        enrich: params.enrich,
        enrichOptions: params.enrich_options ? {
          dependencies: params.enrich_options.dependencies,
          criticalPath: params.enrich_options.critical_path,
          durationEstimates: params.enrich_options.duration_estimates,
          severity: params.enrich_options.severity,
          complexity: params.enrich_options.complexity,
          quickWins: params.enrich_options.quick_wins,
          resources: params.enrich_options.resources,
        } : undefined,
        claimExpiresInDays: params.claim_expires_in_days,
        progressShare: params.progress_share,
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
