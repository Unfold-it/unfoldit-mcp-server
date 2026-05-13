import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnfoldApiError, type UnfoldClient } from "../client.js";

export function registerRevokeClaim(server: McpServer, client: UnfoldClient) {
  server.tool(
    "revoke_claim",
    `Invalidate a claim link so it can no longer be used.

Does not remove access from a user who already claimed the goal.
Use this if a link was sent to the wrong person or needs to be regenerated.`,
    {
      claim_token: z.string().describe("The claim token from the claim link URL (the part after /claim/)"),
    },
    async (params) => {
      try {
        await client.revokeClaim(params.claim_token);
        return {
          content: [{
            type: "text" as const,
            text: "Claim link revoked successfully.",
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
