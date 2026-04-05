# Unfold It MCP Server

Connect AI assistants to [Unfold It](https://unfoldit.ai) -- create goals with AI-generated plans, agent-assisted clarification, plan import with enrichment, and progress tracking.

Built for platforms (academies, LMS tools, coaching apps) that want to use [Unfold It](https://unfoldit.ai) as their execution layer. Three autonomy tiers: fully autonomous, semi-auto with review, or import your own steps with AI enrichment.

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

## Available Tools (7)

### create_goal

Create a goal with an AI-generated plan. The agent auto-answers clarification questions using the context you provide. Set `auto_respond=false` to review agent suggestions before the plan generates.

**Input:**
- `title` (required) -- Goal title
- `description` -- Goal description. More detail produces a better AI plan
- `context` -- Rich context for the agent:
  - `tech_stack` -- e.g. ["Python", "React"]
  - `team_size` -- e.g. 3
  - `timeline` -- e.g. "3 months", "Q3 2026"
  - `constraints` -- e.g. "2 hours per week"
  - `experience_level` -- e.g. "beginner", "advanced"
  - `industry` -- e.g. "fintech"
  - `additional_notes` -- Any other context
- `auto_respond` -- true (default): agent answers all questions. false: returns questions with suggestions for review
- `clarification_answers` -- Pre-set answers by question ID (agent skips these)
- `goal_context` -- "personal" or "professional" (default: "professional")
- `priority` -- "low", "medium", or "high" (default: "medium")
- `claim_expires_in_days` -- Claim link validity (default: 30)
- `progress_share` -- Generate embeddable progress link (default: true)

**Returns:** `goalId`, `claimLink`, `claimToken`, `progressLink`, `planGenerationStatus`, `questions` (if auto_respond=false), `agentAnswersUsed`

### get_goal_status

Get the current status and progress of a goal. Includes agent answer transparency when plan is ready.

**Input:**
- `goal_id` (required) -- The goal ID from create_goal

**Returns:** Goal status, plan generation status, assigned user, step completion, progress link, `agentAnswersUsed`

### get_clarification

Get pending clarification questions with agent-suggested answers and confidence levels. Use after `create_goal` with `auto_respond=false`.

**Input:**
- `goal_id` (required) -- The goal ID from create_goal

**Returns:** Questions with `agentAnswer`, `agentConfidence` (high/medium/low/fallback), `agentSource`

### submit_clarification

Submit answers to clarification questions and trigger plan generation. Provide your own answers for questions you want to override. Agent suggestions are kept for the rest.

**Input:**
- `goal_id` (required) -- The goal ID from create_goal
- `answers` -- Your answers keyed by question ID (only include overrides)
- `accept_agent_answers` -- Accept agent suggestions for unoverridden questions (default: true)

**Returns:** `goalId`, `status`, `planGenerationStatus`, `agentAnswersUsed`

### import_plan

Import a pre-formulated plan with steps and substeps. Skips clarification entirely. AI enriches steps with dependencies, critical path, duration estimates, severity, complexity, and quick-win flags.

**Input:**
- `title` (required) -- Goal title
- `description` -- Goal description
- `steps` (required) -- Array of steps, each with:
  - `title` (required) -- Step title
  - `description` -- Step description
  - `substeps` -- Optional array of substeps with title, description, type (research/work/decision/verification)
- `enrich` -- Run AI enrichment (default: true). Set false for 0 credits
- `enrich_options` -- Control which enrichment features to run:
  - `dependencies`, `critical_path`, `duration_estimates`, `severity`, `complexity`, `quick_wins`, `resources`
- `goal_context` -- "personal" or "professional" (default: "professional")
- `priority` -- "low", "medium", or "high" (default: "medium")
- `claim_expires_in_days` -- Claim link validity (default: 30)
- `progress_share` -- Generate embeddable progress link (default: true)

**Returns:** `goalId`, `planId`, enriched `steps[]` with metadata, `claimLink`

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

### Tier 1 -- Semi-Auto (Review agent suggestions)

1. Call `create_goal` with `auto_respond=false` and your context
2. Get back questions with agent-suggested answers and confidence levels
3. Review suggestions, override any you disagree with
4. Call `submit_clarification` to trigger plan generation
5. Poll `get_goal_status` until `planGenerationStatus` is "completed"

### Tier 2 -- Full-Auto (Agent handles everything)

1. Call `create_goal` with context (auto_respond defaults to true)
2. Agent answers all clarification questions using your context + user history
3. Plan generates in the background (15-30s)
4. Get a claim link immediately -- send it to your user
5. Poll `get_goal_status` for completion and `agentAnswersUsed` transparency

### Tier 3 -- Import (Bring your own steps)

1. Call `import_plan` with your steps and substeps
2. AI enriches with dependencies, durations, severity, critical path
3. Plan is ready immediately (no clarification needed)
4. Get a claim link and enriched step metadata

## Example Prompts

> "Create a Python certification learning path for a beginner with 2 hours per week for 3 months."

> "Import our Jira sprint backlog as a goal with dependencies and time estimates."

> "Create a coaching plan for Sarah but let me review the questions before generating the plan."

> "Show me all goals where the claim link hasn't been used yet."

> "What's the progress on goal abc-123? Has the learner started?"

## Getting an API Key

1. Go to [app.unfoldit.com](https://app.unfoldit.com)
2. Create or switch to your organization
3. Go to Organization settings
4. Scroll to **API Keys** section
5. Click **+ Create Key**, give it a name, and copy the key

## Learn More

- [Unfold It](https://unfoldit.ai) -- AI-powered goal planning and execution platform
- [Developers](https://unfoldit.ai/developers) -- API and MCP documentation
- [GitHub](https://github.com/Unfold-it/unfoldit-mcp-server) -- Source code and issues

## License

MIT
