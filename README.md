# Unfold It MCP Server

Connect AI assistants to [Unfold It](https://unfoldit.ai) -- create goals with AI-generated plans, distribute claim links to users, and track their progress.

Built for platforms (academies, LMS tools, coaching apps) that want to use [Unfold It](https://unfoldit.ai) as their execution layer. One API call creates a goal, generates a personalized AI plan, and returns a link you send to the learner.

## Quick Start

```bash
npx @unfoldit/mcp-server
```

Or install globally:

```bash
npm install -g @unfoldit/mcp-server
```

## Configuration

Set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `UNFOLD_API_KEY` | Yes | Org-scoped API key. Generate at app.unfoldit.com -> Organization -> API Keys |
| `UNFOLD_API_URL` | No | API base URL. Defaults to `https://api.unfoldit.com` |

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "unfoldit": {
      "command": "npx",
      "args": ["@unfoldit/mcp-server"],
      "env": {
        "UNFOLD_API_KEY": "unfold_sk_..."
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "unfoldit": {
      "command": "npx",
      "args": ["@unfoldit/mcp-server"],
      "env": {
        "UNFOLD_API_KEY": "unfold_sk_..."
      }
    }
  }
}
```

## Available Tools

### create_goal

Create a goal in your Unfold It org with AI-generated plan and steps. Returns a one-time claim link to send to the user.

**Input:**
- `title` (required) -- Goal title
- `description` -- Goal description. More detail produces a better AI plan
- `additional_context` -- Extra context (suggested topics, learning objectives)
- `clarification_context` -- Hints for the AI planner:
  - `experience_level` -- e.g. "beginner", "advanced"
  - `timeline` -- e.g. "3 months"
  - `constraints` -- e.g. "2 hours per week"
  - `resources` -- e.g. "solo learner"
  - `success_criteria` -- e.g. "pass certification exam"
- `context` -- "personal" or "professional" (default: "professional")
- `priority` -- "low", "medium", or "high" (default: "medium")
- `claim_expires_in_days` -- Claim link validity (default: 30)
- `progress_share` -- Generate embeddable progress link (default: true)

**Returns:** `goalId`, `claimLink`, `claimToken`, `progressLink`, `planGenerationStatus`

### get_goal_status

Get the current status and progress of a goal.

**Input:**
- `goal_id` (required) -- The goal ID from create_goal

**Returns:** Goal status, plan generation status, assigned user, step completion, progress link

### list_goals

List all goals in your org with optional filters.

**Input:**
- `status` -- Filter by goal status (draft, in_progress, completed, blocked, paused)
- `claim_status` -- Filter by claim status (unclaimed, claimed, expired, revoked)
- `limit` -- Max results (default: 50)
- `offset` -- Pagination offset

**Returns:** Array of goal statuses with progress

### revoke_claim

Invalidate a claim link so it can no longer be used.

**Input:**
- `claim_token` (required) -- The token from the claim link URL

## How It Works

1. **You call `create_goal`** with a title and description
2. **Unfold It's AI generates** clarification questions, auto-answers them, and produces a personalized plan with steps (takes 15-30s in the background)
3. **You get a claim link** immediately -- send it to your user
4. **User clicks the link**, signs up/logs in, auto-joins your org, and lands directly on their goal with the AI plan ready
5. **Track progress** via `get_goal_status` or embed the progress report link in your app

## Example Prompts

Here are real prompts you can give to an AI assistant with this MCP server connected:

> "Create an AI fundamentals learning path for a beginner engineer who has 2 hours per week for 3 months. They need to pass our internal AI readiness assessment."

> "Show me all goals where the claim link hasn't been used yet."

> "What's the progress on goal abc-123? Has the learner started?"

> "Create onboarding goals for these 5 new hires: [names]. Each should have a 'First 90 Days' plan focused on learning our tech stack."

## Getting an API Key

1. Go to [app.unfoldit.com](https://app.unfoldit.com)
2. Create or switch to your organization
3. Go to Organization settings
4. Scroll to **API Keys** section
5. Click **+ Create Key**, give it a name, and copy the key

## Learn More

- [Unfold It](https://unfoldit.ai) -- AI-powered goal planning and execution platform
- [GitHub](https://github.com/Unfold-it/unfoldit-mcp-server) -- Source code and issues

## License

MIT
