# Assessment Payload Convention (v1) [SUPERSEDED]

**Status:** Superseded by [ASSESSMENT_TO_PLAN_MCP.md](./ASSESSMENT_TO_PLAN_MCP.md)
**Version:** `unfold_mcp_v1` (legacy envelope; still supported)
**Last Updated:** 2026-05-13

---

> **Read this first.** New integrations should use the structured `assessment` field on `create_goal` documented in [ASSESSMENT_TO_PLAN_MCP.md](./ASSESSMENT_TO_PLAN_MCP.md). It works on both `POST /api/v1/ext/goals` (the simpler create) and `POST /api/v1/ext/goals/unfold` (the MCP `create_goal` path), gets typed validation at the API boundary, and the planner consumes the same builder for both surfaces internally.
>
> This guide documents the legacy `unfold_assessment` JSON envelope inside `additional_context`. It is preserved for partners that already integrated against it. The envelope continues to work on `POST /api/v1/ext/goals`; behind the scenes it now routes through the same prompt-builder registry as the structured field via a legacy-to-v1 bridge.
>
> **If you send both the structured `assessment` field and the legacy envelope on the same request:** the structured field wins and the response includes a `duplicate_assessment_input` warning. Remove the legacy envelope to clean up.
>
> **What's gone:** the envelope was the only path for partners using `/goals` and worked nowhere else. The structured field is the only path for `/goals/unfold` and the recommended path for `/goals`.

---

## Overview

When a client system (CS) creates an Unfold goal after a skill assessment, it can pass structured assessment results inside the `additional_context` field on `POST /api/v1/ext/goals`. This tells Unfold's plan synthesis exactly what the learner is weak and strong at, so the generated plan prioritizes the right areas instead of being generic.

Without this convention, plan quality varies because each client formats assessment context differently and the LLM has to guess what matters. With it, the plan synthesis prompt is tuned once to look for the `unfold_assessment` block and generate a targeted plan.

---

## Payload Shape

Include an `unfold_assessment` block inside `additional_context`:

```json
{
  "title": "Improve Python proficiency for ML pipeline work",
  "description": "Learner needs to reach medium Python proficiency to take on ML feature work",
  "additional_context": {
    "unfold_assessment": {
      "skill": "Python",
      "target_band": "medium",
      "achieved_band": "low",
      "raw_pct": 28,
      "gap_bands": 2,
      "weak_facets": ["list comprehensions", "decorators", "exception handling"],
      "strong_facets": ["basic syntax", "control flow"],
      "per_question_summary": [
        { "facet": "decorators", "difficulty": "medium", "correct": false },
        { "facet": "list comprehensions", "difficulty": "easy", "correct": false }
      ],
      "work_item_context": {
        "title": "Build the feature pipeline service",
        "description": "Stand up a service that ingests events and produces feature vectors"
      },
      "assessed_at": "2026-04-15T10:00:00Z",
      "assessment_source": "unfold_mcp_v1"
    }
  },
  "auto_generate_plan": true
}
```

### Field Reference

| Field | Required? | Type | Description |
|-------|-----------|------|-------------|
| `skill` | Yes | string | The skill that was assessed (e.g. "Python", "SQL") |
| `target_band` | Yes | string | The proficiency band the learner should reach (`beginner`, `low`, `medium`, `high`) |
| `achieved_band` | Yes | string | The band the learner actually scored in |
| `raw_pct` | No | number | The learner's raw percentage score (0-100) |
| `gap_bands` | No | integer | How many bands short of the target (0 if at or above) |
| `weak_facets` | No | string[] | Sub-skills the learner missed. Plan will prioritize these. |
| `strong_facets` | No | string[] | Sub-skills the learner passed. Plan will skip or compress these. |
| `per_question_summary` | No | object[] | Per-question breakdown (facet, difficulty, correct). Informational; plan synthesis uses `weak_facets` / `strong_facets` directly. |
| `work_item_context` | No | object | The work item the assessment was anchored to. Plan will reference it. |
| `work_item_context.title` | No | string | Work item title |
| `work_item_context.description` | No | string | Work item description |
| `assessed_at` | No | ISO8601 | When the assessment was taken |
| `assessment_source` | Yes | string | Convention version. Must be `"unfold_mcp_v1"` for this version. |

---

## What Plan Synthesis Does With It

When `unfold_assessment` is present and `assessment_source` is `"unfold_mcp_v1"`, the plan synthesis prompt:

1. **Prioritizes `weak_facets`** as the primary plan focus. Steps will concentrate on the areas the learner missed.
2. **Skips or compresses `strong_facets`**. The learner already demonstrates proficiency here; the plan won't waste time on basics they know.
3. **Anchors learning examples to `work_item_context`** so the plan feels relevant to the learner's actual work, not a generic textbook exercise.
4. **Uses `target_band` as the success criterion** in the goal description.
5. **Does NOT include assessment questions** in the plan steps (the assessment is done; the plan is about closing the gap).

---

## Versioning

The `assessment_source` field carries the convention version:

- **`unfold_mcp_v1`** -- the current and only version.
- New fields may be added in future versions without breaking compatibility (additive-only).
- Breaking changes (renaming fields, changing semantics) will bump to `unfold_mcp_v2`, and the synthesis prompt will branch on the version.
- Unknown versions are silently ignored (plan generates as if no assessment was provided).

---

## End-to-End Example

```
1. CS calls generate_skill_assessment(skill="Python", target="medium", num=8)
2. Unfold returns 8 MCQs + assessment_token + band_map
3. Learner answers in CS UI
4. CS calls score_skill_assessment(token, answers)
5. Unfold returns {band: "low", gap_bands: 2, weak_facets: [...], suggested_goal_seed: {...}}
6. CS calls POST /api/v1/ext/goals with:
     - title from suggested_goal_seed.title
     - description from suggested_goal_seed.summary
     - additional_context: { "unfold_assessment": { ...full payload... } }
     - auto_generate_plan: true
7. Unfold generates a plan that focuses on the weak facets and uses the
   work item context from the assessment
8. CS gets back claim_link + progress_link
```
