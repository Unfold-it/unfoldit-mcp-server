# Unfold It MCP Server

Connect AI assistants to [Unfold It](https://unfoldit.ai) -- create goals with AI-generated plans, agent-assisted clarification, plan import with enrichment, individual progress tracking, cohort analytics, and skill assessments.

Built for platforms (academies, LMS tools, coaching apps) that want to use [Unfold It](https://unfoldit.ai) as their execution layer. Three autonomy tiers: fully autonomous, semi-auto with review, or import your own steps with AI enrichment. Generate skill assessments with AI-validated MCQs, score them, and automatically create targeted learning paths from the results. Tag goals with custom metadata to track and analyze entire cohorts.

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

## API Key Scopes

Your API key needs specific scopes depending on which tools you use:

| Scope | Tools | Included by default? |
|-------|-------|---------------------|
| `goals:create` | create_goal, unfold_goal, submit_clarification, import_plan | Yes |
| `goals:read` | get_goal_status, list_goals, get_analytics, get_clarification | Yes |
| `claims:manage` | revoke_claim | Yes |
| `assessment:generate` | generate_skill_assessment | **No** -- must be granted explicitly |
| `assessment:score` | score_skill_assessment | **No** -- must be granted explicitly |
| `assessment:read_capabilities` | get_assessment_capabilities | **No** -- must be granted explicitly |

Assessment scopes are opt-in. Ask your org owner to enable them in the API Key settings.

## Available Tools (12)

### create_goal

Create a goal with an AI-generated plan. The agent auto-answers clarification questions using the context you provide. Set `auto_respond=false` to review agent suggestions before the plan generates. Tag goals with `metadata` to group and analyse entire cohorts.

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
- `metadata` -- Custom key-value tags for analytics grouping, e.g. `{ cohort: "spring-2026", track: "frontend" }`
- `category` -- Resource category hint: "learning", "health_adhd", or "general". Auto-detected from goal title and description if not provided. Determines which sources and search strategies are used when attaching resources to substeps.
- `resource_world` -- Override resource discovery for this goal:
  - `preferred_sources` -- Source domains to prioritise, e.g. `["coursera.org", "docs.python.org"]`
  - `excluded_sources` -- Source domains to suppress
  - `youtube_playlists` -- YouTube playlist IDs to draw resources from
  - `lms_search_endpoint` -- Custom LMS search endpoint URL
  - `content_policies` -- `{ require_verified_sources, show_disclaimer, disclaimer_text }`

**Returns:** `goalId`, `claimLink`, `claimToken`, `progressLink`, `planGenerationStatus`, `questions` (if auto_respond=false), `agentAnswersUsed`

### get_goal_status

Get the current status and full step-by-step detail of a goal. Returns individual step data (timestamps, time spent, blocker count, substep progress) when the plan is ready.

**Input:**
- `goal_id` (required) -- The goal ID from create_goal

**Returns:** Goal status, `progress`, `resourceCategory`, `steps[]` (with per-step detail when plan is ready), `metadata`, `claimCreatedAt`, `claimedAt`, `assignedTo`, `agentAnswersUsed`

### get_analytics

Aggregated cohort analytics across all API-created goals. Returns KPIs, at-risk learners, a step-level drop-off funnel, and optional breakdowns by metadata dimension or resource type.

**Input:**
- `group_by` -- Metadata key to break down completion rates by (e.g. "track", "cohort", "department")
- `inactive_days` -- Flag goals with no step activity in this many days as at-risk (default: 7)
- `include_funnel` -- Include step-by-step completion funnel (default: true)
- `include_resources` -- Include resource engagement by type and source (default: false)
- `metadata` -- Filter to a specific cohort or segment, e.g. `{ cohort: "spring-2026" }`
- `date_from` -- ISO date (YYYY-MM-DD). Only include goals created on or after this date
- `date_to` -- ISO date (YYYY-MM-DD). Only include goals created on or before this date

**Returns:**
- `totalGoals`, `activeGoals`, `completedGoals`, `blockedGoals`, `completionRate`, `avgDaysToComplete`
- `claimsTotal`, `claimsClaimed`, `claimsPending`, `claimsExpired`, `avgHoursToClaim`
- `atRiskCount`, `atRiskGoals[]` (goalId, title, metadata, daysInactive, progressPercent)
- `completionByDimension[]` (when group_by is set)
- `stepFunnel[]` (stepOrder, stepTitle, completionRate, avgHoursToComplete)
- `resourceEngagement[]` (when include_resources=true)

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
- `metadata` -- Custom key-value tags for analytics grouping, e.g. `{ cohort: "spring-2026", track: "backend" }`

**Returns:** `goalId`, `planId`, enriched `steps[]` with metadata, `claimLink`

### list_resource_categories

List available resource categories for goal classification. Returns each category's active providers, content safety policies, and disclaimer text. Use this to build adaptive UIs or to discover which categories are available before creating goals.

**Input:** None

**Returns:** Array of categories, each with `id`, `name`, `description`, `activeProviders`, `showDisclaimer`, `disclaimerText`

### list_goals

List all goals in your org with optional filters. Use `metadata` to filter to a cohort, `category` to segment by goal type, `assigned_email` to look up a specific learner, or `inactive_days` to find at-risk goals without pulling full analytics.

**Input:**
- `status` -- Filter by goal status (draft, in_progress, completed, blocked, paused)
- `claim_status` -- Filter by claim status (unclaimed, claimed, expired, revoked)
- `category` -- Filter by resource category (learning, health_adhd, general). Use this to segment ADHD goals from learning goals in a mixed cohort.
- `metadata` -- Filter by metadata tag(s) in "key=value" format, e.g. `["track=frontend", "cohort=spring-2026"]`
- `assigned_email` -- Return only the goal assigned to this learner email
- `inactive_days` -- Return only goals with no step activity in the last N days (1-365)
- `limit` -- Max results (default: 50)
- `offset` -- Pagination offset

**Returns:** Array of goal statuses with `progress`, `resourceCategory`, `metadata`, `claimCreatedAt`, `claimedAt`

### revoke_claim

Invalidate a claim link so it can no longer be used.

**Input:**
- `claim_token` (required) -- The token from the claim link URL

### generate_skill_assessment

Generate a skill-proficiency assessment (MCQs) for a learner. Questions are AI-generated and validated (structural + semantic checks) before being returned. Returns a signed `assessment_token` that the learner's answers are scored against.

**Input:**
- `work_item_context` (required) -- The work item the learner is preparing for:
  - `title` (required) -- Work item title
  - `description` -- Work item description (max 2000 chars)
  - `domain_tags` -- Tags for question anchoring
- `skill` (required) -- Skill to assess (e.g. "Python", "SQL", "Project Management")
- `target_proficiency` (required) -- Band the learner should reach: "beginner", "low", "medium", "high"
- `num_questions` (required) -- Number of MCQs to generate (3-20)
- `difficulty_mix` -- Distribution as `{easy, medium, hard}` floats summing to 1.0. Default: `{easy: 0.2, medium: 0.5, hard: 0.3}`
- `band_thresholds` -- Custom proficiency band ranges. Default: beginner [0,10], low [11,50], medium [51,85], high [86,100]
- `language` -- ISO language code (default: "en")
- `request_id` (required) -- Idempotency key. Same request_id returns the same assessment.

**Returns:** `assessment_token`, `questions[]` (stem, options, difficulty, skill_facet), `band_map`, `max_raw_score`, `target_band`, `model_meta`

**Requires scope:** `assessment:generate`

### score_skill_assessment

Score a submitted assessment using the signed `assessment_token` from `generate_skill_assessment`. Returns the learner's proficiency band, gap vs target, and per-question results. When the learner falls short, includes a `suggested_goal_seed` you can pass to `create_goal` to create a targeted learning path.

**Input:**
- `assessment_token` (required) -- The signed token from generate_skill_assessment
- `answers` (required) -- Array of `{question_id, selected_option_id}` (at least one)
- `band_thresholds` -- Optional override of proficiency band ranges (defaults to the thresholds embedded in the token)
- `request_id` (required) -- Idempotency key

**Returns:** `raw_score`, `max_raw_score`, `raw_pct`, `band`, `target_band`, `gap_bands`, `per_question[]`, `recommended_action` (none / create_unfold_goal), `suggested_goal_seed`

**Requires scope:** `assessment:score`

### get_assessment_capabilities

Get supported parameters for skill assessments. Use this to introspect before calling `generate_skill_assessment`. No input parameters required.

**Returns:** `schema_version`, `supported_languages`, `min_questions`, `max_questions`, `supported_proficiency_bands`, `default_band_thresholds`, `default_difficulty_mix`, `open_domain`, `token_ttl_seconds`

**Requires scope:** `assessment:read_capabilities`

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

### Assess-then-Learn (Assessment to goal)

1. Call `get_assessment_capabilities` to check supported skills and defaults
2. Call `generate_skill_assessment` with the skill, target proficiency, and work item context
3. Present questions to the learner in your UI
4. Call `score_skill_assessment` with the token and the learner's answers
5. If `gap_bands > 0`, use `suggested_goal_seed` to call `create_goal` with the assessment data in `additional_context` (see [payload convention](https://github.com/Unfold-it/unfoldit-mcp-server#assessment-payload-convention))
6. Unfold generates a plan that focuses on the learner's weak areas
7. Send the claim link to the learner

## Example Prompts

> "Create a Python certification learning path for a beginner with 2 hours per week for 3 months."

> "Import our Jira sprint backlog as a goal with dependencies and time estimates."

> "Create a coaching plan for Sarah but let me review the questions before generating the plan."

> "Create an ADHD morning routine coaching plan with category health_adhd for a patient who struggles with time blindness."

> "List all health_adhd goals in the spring cohort and show me which ones are at risk."

> "Show me all goals where the claim link hasn't been used yet."

> "What's the progress on goal abc-123? Has the learner started?"

> "Generate a Python assessment with 8 questions for someone who needs medium proficiency to work on the ML pipeline."

> "Score this assessment and create a goal from the results if the learner didn't reach the target."

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
