# Assessment to Plan, via MCP

**Status:** Active
**Last Updated:** 2026-05-13
**Audience:** Engineers integrating with Unfold's MCP server or REST API to drive the score-to-plan chain (academy products, learning platforms, coaching apps, ADHD products).

---

## What you build

A learner takes a skill (or clinical) assessment in your product. You score it through Unfold, drop the score response into Unfold's goal creation, and the learner receives a claim link to a fully personalised AI-generated plan that prioritises their weak areas and respects their context. No client-side joins, no threshold tuning, no prose smuggling.

Three tools, one chain:

```
generate_skill_assessment ──► [learner answers] ──► score_skill_assessment ──► create_goal (with assessment field)
```

This guide walks through that chain for the canonical case (skill_proficiency) and the variants (general, clinical_intake). All examples use the [@unfoldit/mcp-server](https://github.com/Unfold-it/unfoldit-mcp-server) npm package v0.7.0 or later. REST examples follow if you are integrating without an MCP client.

If you are looking at the legacy `unfold_assessment` envelope inside `additional_context`, see [ASSESSMENT_PAYLOAD_CONVENTION.md](./ASSESSMENT_PAYLOAD_CONVENTION.md). That path still works for backwards compat but is superseded by this guide.

---

## Step 1: Generate an assessment

Call `generate_skill_assessment` with the skill, target proficiency, and the work item the learner is preparing for.

```js
const assessment = await mcp.tools.call("generate_skill_assessment", {
  skill: "Python",
  target_proficiency: "medium",
  num_questions: 8,
  work_item_context: {
    title: "Build the feature pipeline service",
    description: "ETL using pandas and Airflow; needs Python proficiency at medium band.",
  },
  request_id: crypto.randomUUID(),
});
```

Response carries:

- `assessment_token` -- signed, opaque to you, must be returned at score time.
- `questions[]` -- MCQs to render in your UI.
- `band_map` -- proficiency band thresholds (also embedded in the token).
- `model_meta` -- which provider/model generated the questions, for telemetry.

**Why `work_item_context` matters.** It is the strongest grounding signal in the whole chain. The same work item flows through scoring and into goal creation; the planner uses it to anchor steps in real-world application instead of generic textbook material. Pass title + description whenever you have them, even for assessments that feel abstract.

**Typed errors to handle** (branch on `error_code`):

- `models_not_configured`, `provider_unauthorized`, `provider_quota_exceeded`: your BYO provider settings need attention. Some include `settings_url` and a `switch_to_unfold_ai` CTA the user can take.
- `validation_failed`: generation produced output the validator rejected after retry budget. Retry with a different `request_id`, or reduce `num_questions`.
- `idempotency_conflict`: same `request_id` was used with a different request body. Pick a new one.

---

## Step 2: Render and collect answers

Your UI's job. Each question has `id` and `options[{id, text}]`. The learner picks one option per question. You collect them into:

```js
const answers = questions.map(q => ({
  question_id: q.id,
  selected_option_id: userPicks[q.id],
}));
```

Hold onto `assessment_token` -- you need it for scoring. Hold onto `work_item_context` from step 1 -- you will pass it through to goal creation in step 4.

---

## Step 3: Score the assessment

Call `score_skill_assessment` with the token and the answers.

```js
const score = await mcp.tools.call("score_skill_assessment", {
  assessment_token: assessment.assessment_token,
  answers,
  request_id: crypto.randomUUID(),
});
```

Response (the canonical "drop into create_goal" shape):

```json
{
  "raw_score": 5.0,
  "max_raw_score": 8.0,
  "raw_pct": 62.5,
  "band": "medium",
  "target_band": "medium",
  "gap_bands": 0,
  "per_question": [...],
  "per_facet": [
    {"facet": "basic syntax",     "total": 4, "correct": 4, "raw_pct": 100, "classification": "strong"},
    {"facet": "list comprehensions","total": 2, "correct": 0, "raw_pct": 0,  "classification": "weak"}
  ],
  "weak_facets": ["list comprehensions"],
  "strong_facets": ["basic syntax"],
  "facet_coverage": "full",
  "recommended_action": "none",
  "suggested_goal_seed": null
}
```

**Read these fields:**

- `band` and `target_band`: the learner achieved and the target you set in step 1.
- `gap_bands`: how many bands they fell short. `0` means they hit or exceeded target.
- `per_facet`: server-side aggregation grouped by sub-skill. Useful if you want to render a strengths/weaknesses panel in your UI.
- `weak_facets` / `strong_facets`: convenience projections of `per_facet`. The same lists go straight into `create_goal.assessment` so the planner biases steps accordingly.
- `facet_coverage`: quality flag. `"full"` means every question had a real LLM-emitted facet label. `"partial"` means some used a `difficulty:<level>` synthetic fallback. `"difficulty_fallback"` means no real facets. Soften your UI when coverage is not `"full"`.
- `recommended_action`: `"none"` (target hit), `"create_unfold_goal"` (gap exists, build a plan), or `"retake"`.
- `suggested_goal_seed`: when `recommended_action == "create_unfold_goal"`, this is a pre-filled `{title, summary, skill_focus, target_proficiency}` you can use as a starting point for the goal you create in step 4.

**Typed errors to handle:**

- `token_invalid`: signature mismatch or malformed token. Regenerate via `generate_skill_assessment`.
- `assessment_expired`: token past TTL. Regenerate.
- `idempotency_conflict`: same `request_id` with different answers; pick a new one.

---

## Step 4: Create the goal with the assessment field

When there is a gap (or your product creates a goal regardless), call `create_goal` and drop the score response into the `assessment` field.

```js
const goal = await mcp.tools.call("create_goal", {
  title: `Reach ${score.target_band} Python proficiency for the feature pipeline`,
  description: "Learner is preparing for the ML feature pipeline service. Close the gap from low to medium on Python, with a focus on list comprehensions.",
  category: "learning",  // align with skill_proficiency for resource routing
  goal_context: "professional",
  metadata: { cohort: "spring-2026", track: "ml-engineering" },
  assessment: {
    assessment_type: "skill_proficiency",
    schema_version: "v1",
    skill: "Python",
    target_band: score.target_band,
    achieved_band: score.band,
    raw_pct: score.raw_pct,
    gap_bands: score.gap_bands,
    weak_facets: score.weak_facets,
    strong_facets: score.strong_facets,
    per_question_summary: score.per_question.map(q => ({
      // optional: facet/difficulty if your UI surfaces them
      correct: q.correct,
    })),
    work_item_context: {
      title: "Build the feature pipeline service",
      description: "ETL using pandas and Airflow; needs Python proficiency at medium band.",
    },
    assessed_at: new Date().toISOString(),
  },
});
```

Response carries `goalId`, `claimLink` (send this to the learner), `planGenerationStatus` (`"generating"`; poll `get_goal_status` for `"completed"`), and `warnings`.

**Why the structured field beats prose.** Without `assessment`, you would have to stuff the score into `description` as free text and hope the planner notices. With it, the backend dispatches via a typed prompt-builder registry that produces an explicit "Skill Assessment Results" section in the planner prompt with instructions to prioritise weak facets, compress strong ones, and anchor steps in the work item. Deterministic, validated, no guesswork.

**Typed errors to handle:**

- `assessment_type_not_supported`: the type is recognised but its prompt builder is not yet wired (e.g. `clinical_intake` until a real partner drives it). Response includes a `supported` list of `(assessment_type, schema_version)` pairs you can use today.
- `assessment_type_not_enabled_for_org`: your org has not opted into this type. Default-on types (`skill_proficiency`, `general`) should never hit this. Sensitive types (`clinical_intake`) default off and need superadmin enablement; contact your admin.
- `models_not_configured` / `provider_*`: same shape as step 1.

**Warnings to surface (non-fatal):**

- `category_assessment_type_mismatch`: you sent `category: "learning"` with `assessment_type: "clinical_intake"` (or similar). The plan was still generated using `assessment_type`; align `category` if you want category-aware resource routing to match.
- `duplicate_assessment_input`: you sent both the structured field and the legacy `additional_context.unfold_assessment` envelope. Structured wins; remove the legacy envelope.

---

## Variants

### General assessment

For data that does not fit `skill_proficiency` or `clinical_intake` -- e.g. soft-skills intake, freeform learning goals -- use `general` v1. The planner treats input as soft hints rather than hard constraints, with one exception: items under `constraints` are honoured as hard limits.

```js
const goal = await mcp.tools.call("create_goal", {
  title: "Improve customer-facing presentation skills",
  category: "general",
  assessment: {
    assessment_type: "general",
    schema_version: "v1",
    summary: "Learner is transitioning into a customer-facing role and wants to strengthen presentation skills before Q3 board reviews.",
    focus_areas: ["public speaking", "slide design", "Q&A handling"],
    avoid_areas: ["technical deep dives"],
    constraints: ["no after-hours work", "must use existing internal templates"],
    assessed_at: new Date().toISOString(),
  },
});
```

### Clinical intake (ADHD / coaching)

The wire shape is locked in v1 today. Build your integration against it now; the prompt builder is currently stubbed and will return `assessment_type_not_supported` until a real partner drives the design. Sensitive type -- requires superadmin enablement per org.

```js
const goal = await mcp.tools.call("create_goal", {
  title: "Build a sustainable morning routine",
  category: "health_adhd",
  assessment: {
    assessment_type: "clinical_intake",
    schema_version: "v1",
    subject_profile: {
      age: 32,
      age_band: "adult",
      self_identifies_as: "patient",
    },
    target_areas: ["morning routine", "task initiation"],
    diagnoses: [
      { condition: "ADHD-PI", diagnosed_at: "2024-03", diagnosed_by: "clinician" },
    ],
    screening_results: [
      { instrument: "ASRS-v1.1", score: 17, interpretation: "high likelihood" },
    ],
    current_struggles: ["time blindness around medication", "weekend regression"],
    strengths: ["hyperfocus on creative work"],
    constraints: {
      medication: "Vyvanse 30mg mornings",
      comorbidities: ["mild anxiety"],
      accommodations_in_place: ["flexible hours at work"],
    },
    clinician_notes: "Stabilise medication routine before introducing habit work.",
    assessor_role: "clinician",
    assessed_at: new Date().toISOString(),
  },
});
```

---

## Capability flags

`assessment_type` is gated per org:

| Capability | Default | Sensitive? | Notes |
|---|---|---|---|
| `skill_proficiency` | On | No | Default for every org. No setup needed. |
| `general` | On | No | Default for every org. |
| `clinical_intake` | Off | Yes | Superadmin enablement only. Contact your Unfold rep. |

Org admins can read effective flags via `GET /api/v1/orgs/{org_id}/mcp-capabilities` and toggle non-sensitive flags via `PUT` to the same path. Sensitive flags require Unfold superadmin action.

---

## REST equivalents

If you are integrating without the MCP package (server-to-server, no agent loop), every example above maps onto direct REST calls:

| MCP tool | REST endpoint |
|---|---|
| `generate_skill_assessment` | `POST /api/v1/ext/assessments/generate` |
| `score_skill_assessment` | `POST /api/v1/ext/assessments/score` |
| `create_goal` (unfold path) | `POST /api/v1/ext/goals/unfold` |
| `create_goal` (simple path) | `POST /api/v1/ext/goals` |

Authentication: `Authorization: Bearer <your-org-api-key>`. Same request and response shapes as the MCP tools (snake_case for assessment fields, camelCase for goal fields per the existing convention).

The MCP package's main value over direct REST is (a) tool descriptions your coding agent reads at call time, and (b) the `UnfoldApiError` class that surfaces typed errors structurally instead of as stringified messages. Direct REST integrations parse the same JSON envelope from the FastAPI `{detail: ...}` shape.

---

## Telemetry to add on your side

- Capture `facet_coverage` per scored assessment. If you see a lot of `"partial"` or `"difficulty_fallback"` for a particular skill, that is signal to us that the generator's facet labelling needs tightening; flag it back to your Unfold rep.
- Capture warnings on goal creation by code. `category_assessment_type_mismatch` should be near zero in production; if it spikes, you have a mapping bug between your category selection and assessment_type.
- Capture `recommended_action` distributions on score responses. Helps you see how often learners hit target vs need a goal.

---

## Versioning and compatibility

The `assessment` field uses `schema_version` per variant. Today only `v1` exists for each type. When `v2` lands, we will:

1. Continue accepting `v1` indefinitely for currently-shipped variants.
2. Document the migration in a successor section of this guide.
3. Bump the MCP package minor version.

See [MCP_VERSIONING.md](./MCP_VERSIONING.md) for the full MCP package versioning policy.

---

## Related docs

- [ASSESSMENT_PAYLOAD_CONVENTION.md](./ASSESSMENT_PAYLOAD_CONVENTION.md) -- legacy `unfold_assessment` envelope (superseded by this guide).
- [MCP_VERSIONING.md](./MCP_VERSIONING.md) -- MCP package versioning policy and supported-versions window.
- [CHANGELOG.md](../../CHANGELOG.md) -- what changed in each MCP package release.
