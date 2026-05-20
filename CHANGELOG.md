# Changelog

All notable changes to `@unfoldit/mcp-server` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [semver](https://semver.org).

## [0.8.0] - 2026-05-20

### Added

- **`request_id` on `create_goal`.** Optional caller-supplied idempotency
  key. Within a 5-minute window, two calls with the same `request_id`
  return the SAME goal and claim link instead of creating a new one.
  Designed for academy / partner integrations that retry on network
  blips or process restarts. Construct from your own per-learner
  identifier (e.g. `enrollment:42:learner:7`). **Two different learners
  MUST use different keys** -- reusing a key across learners hands the
  second learner a claim link the first learner already claimed.
  When the field is omitted, every call still creates a fresh goal
  exactly like in 0.7.x. See the
  [Idempotency section](./README.md#idempotency) of the README for the
  full rules and a code snippet.
- **`idempotentReplay` on `ExtGoalCreated` and `ExtUnfoldResponse`.**
  Boolean. `true` when the response was served from the idempotency
  cache (a prior call with the same `request_id` produced this goal).
  `false` on a fresh create. Lets partners branch retries
  deterministically.
- **`claimStatus` on `ExtUnfoldResponse`.** Current state of the
  underlying claim token: `"unclaimed" | "claimed" | "expired" |
  "revoked"`. `null` on a fresh create (implicitly "unclaimed").
  Populated on idempotent replays by refreshing the DB so partners can
  detect a link that has been consumed since the original create. On
  `ExtGoalCreated` the existing top-level `status` field serves the
  same role and is similarly refreshed on replays.

### Behaviour notes

- The idempotency cache is **in-process per pod** with a 5-minute TTL.
  Retries that land on a different Cloud Run pod or arrive after a pod
  restart will miss the cache and create a fresh goal. Treat the window
  as a retry helper, not a deduplication guarantee. A Redis-backed
  cache is on the roadmap.
- The wire field name is `requestId` (camelCase) -- the same name
  already used on Tier 1 unfold since 0.6 -- so partners learn one
  rule across the create surface.

### Backwards compatibility

- `request_id` is optional with no default behaviour. Existing
  integrations that do not send it are unaffected.
- `idempotentReplay` and `claimStatus` are new fields on the response.
  Clients that ignore unknown fields are unaffected. TypeScript
  consumers that construct `ExtGoalCreated` / `ExtUnfoldResponse`
  manually (e.g. in tests) now need to populate `idempotentReplay` --
  wire-deserialised responses are not impacted because the backend
  always populates it.

## [0.7.1] - 2026-05-13

### Changed

- **Docs landed in the package repo.** The three partner-facing guides
  (`ASSESSMENT_TO_PLAN_MCP`, `MCP_VERSIONING`,
  `ASSESSMENT_PAYLOAD_CONVENTION`) now live in `docs/guides/` in this
  repo so they are publicly accessible. The 0.7.0 README linked to
  internal URLs that were not reachable for partners; all README links
  rewritten to relative paths.
- `package.json` now declares `repository`, `homepage`, and `bugs` so
  the npmjs.com landing page renders the right "Repository" link and
  relative links in the README resolve correctly on the npm side too.

No code changes. This is a patch-level doc + metadata fix.

## [0.7.0] - 2026-05-13

### Added

- **`assessment` field on `create_goal`.** Structured assessment input as a
  discriminated union over `assessment_type`. Three v1 variants:
  - `skill_proficiency`: scored skill assessment. Designed so partners can
    drop the response from `score_skill_assessment` straight in (plus
    `assessment_type`, `schema_version`, and `assessed_at` headers).
  - `clinical_intake`: ADHD / coaching / clinical context. Wire shape is
    locked in v1; the backend prompt builder is currently a stub and will
    return `assessment_type_not_supported` until a real partner drives it.
    Build integrations now; switch on when the backend lands.
  - `general`: deliberately-weaker catch-all for assessment data that
    does not fit either typed shape. Treated as soft hints; only
    `constraints` are honoured as hard limits.
- **Per-facet aggregation on `score_skill_assessment` response.** New
  fields: `per_facet` (one entry per sub-skill with `total`, `correct`,
  `raw_pct`, `classification`), `weak_facets` (string[]), `strong_facets`
  (string[]), `facet_coverage` ("full" | "partial" | "difficulty_fallback").
  Computed server-side from facets embedded in the signed token, so
  partners do not write client-side join logic.
- **`warnings` field on `ExtUnfoldResponse` and `ExtGoalCreated`.**
  Non-fatal warnings let partners self-correct without the request being
  rejected. Always present (empty list when none) for stable TS shape.
  Known codes:
  - `category_assessment_type_mismatch`: goal `category` and
    `assessment.assessment_type` disagree.
  - `duplicate_assessment_input`: both the structured `assessment`
    field and the legacy `additional_context.unfold_assessment`
    envelope were sent on the same request.
- **`UnfoldApiError` class.** Thrown by the REST client when the API
  returns a typed error envelope. Preserves `errorCode`, `message`,
  `status`, and the rest of the structured payload (e.g. `settings_url`,
  `switch_to_unfold_ai` CTA, `supported` for
  `assessment_type_not_supported`). All tool handlers now surface these
  as JSON payloads so AI agents can branch on `error_code` rather than
  regex-parsing a stringified message.

### Changed

- Tool descriptions refreshed across `create_goal`,
  `generate_skill_assessment`, and `score_skill_assessment` to make the
  generate -> score -> create_goal chain explicit and to list the
  typed errors agents should branch on.
- `score_skill_assessment` response is now shape-compatible with the
  `assessment` field on `create_goal` (skill_proficiency v1 variant);
  drop it in with `assessment_type`, `schema_version`, and `assessed_at`
  headers and the planner uses it directly.

### Backwards compatibility

- All new fields on `create_goal` are optional. Existing integrations
  that do not send `assessment` are unaffected.
- `warnings` is a new field on responses but defaults to an empty array;
  clients that ignore unknown fields are not impacted.
- The structured `assessment` field supersedes the legacy
  `additional_context.unfold_assessment` envelope. The legacy envelope
  still works; if both are sent, the structured field wins and a
  `duplicate_assessment_input` warning is returned. Migrate when
  convenient.

## [0.6.0] - 2026-05

### Added

- `list_resource_categories` tool.
- Category filter on `list_goals`.

## [0.5.0]

### Added

- `category` and `resource_world` on `create_goal`.
