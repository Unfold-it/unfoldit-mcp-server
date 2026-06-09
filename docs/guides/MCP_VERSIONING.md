# MCP Package Versioning Policy

**Status:** Active
**Last Updated:** 2026-05-13
**Audience:** Engineers integrating with the [@unfoldit/mcp-server](https://github.com/Unfold-it/unfoldit-mcp-server) npm package, and Unfold engineers shipping changes to it.

---

## TL;DR

- The MCP package uses semver. Pin a minor version range (`"@unfoldit/mcp-server": "^0.7.0"`).
- We support the **latest two minor versions** at any time. Older minors stop receiving fixes once a third minor ships.
- **Breaking changes get a major bump** (1.x to 2.x) and at least one minor release of deprecation warnings before the removal lands.
- **Additive changes are minor bumps** (0.7 to 0.8). They never remove or rename fields, never change semantics of existing fields, never tighten existing validation.
- **Patches are bug fixes only.** No new fields, no description changes that alter semantics.

If your integration breaks after a package upgrade, treat it as a bug on our side and report it -- the policy is designed so additive changes never break working integrations.

---

## What counts as breaking

A change is **breaking** if a working integration on the previous minor version stops working after the upgrade. Concretely:

| Change | Breaking? | Versioning |
|---|---|---|
| Adding a new optional field to a tool input | No | Minor |
| Adding a new field to a tool output | No (clients ignore unknown) | Minor |
| Adding a new tool | No | Minor |
| Adding a new value to an existing enum | No (clients should handle unknown) | Minor |
| Tightening validation on an optional field | Yes | Major |
| Renaming a field | Yes | Major |
| Removing a tool | Yes | Major |
| Removing a field from input or output | Yes | Major |
| Removing a value from an enum | Yes | Major |
| Changing semantics of an existing field | Yes | Major |
| Changing the default value of an existing field | Sometimes (judgement call) | Minor + CHANGELOG warning, or Major |
| Tool description edit (no semantic change) | No | Patch |
| Bug fix in a tool implementation | No | Patch |

We err on the side of "treat it as breaking" when in doubt. The cost of a major bump is small; the cost of breaking partners is large.

---

## Supported-versions window

| MCP package version | Support status | Notes |
|---|---|---|
| `^0.9.x` (current) | Active | Fixes and minor additions land here. |
| `^0.8.x` | Maintenance | Security fixes only. Stop receiving feature additions. |
| `<= 0.7.x` | Unsupported | Upgrade required. The REST API still accepts your requests, but the MCP tool surface has drifted. |

**Maintenance window length:** at minimum until a third minor lands. So when `0.10.0` ships, `0.8.x` exits maintenance. If we ship a breaking major (`1.0.0`), `0.9.x` enters maintenance and stays there for at least 6 months to give partners time to upgrade.

You can always see the current support state in the [CHANGELOG.md](../../CHANGELOG.md) at the top of the file.

---

## Deprecation policy

Before any field, tool, or enum value is removed:

1. At least one minor release ships with a CHANGELOG entry under `Deprecated`, documenting:
   - What is being deprecated.
   - The earliest version that removes it.
   - The migration path (replacement field, new tool, etc.).
2. The next major release removes it.

Example timeline:

```
0.7.0: ships `legacy_field`.
0.8.0: deprecates `legacy_field` in CHANGELOG. Field still works.
0.9.0: deprecation still in effect. Field still works. Migration guide referenced.
1.0.0: `legacy_field` removed.
```

The MCP tool's `describe()` text gets a `[DEPRECATED, removed in 1.0]` prefix during the deprecation window so agents reading the description at call time see the warning.

---

## How to pin

In your `package.json`:

```json
{
  "dependencies": {
    "@unfoldit/mcp-server": "^0.7.0"
  }
}
```

`^0.7.0` accepts `0.7.x` and `0.8.x` (additive minors), rejects `1.0.0` (breaking major). This is what we recommend: you get fixes and additive features automatically, breaking changes never land without an explicit major bump in your `package.json`.

Avoid:

- Pinning exactly (`"0.7.0"`): you miss fixes.
- Pinning to a major (`"*"` or `">=0"`): breaking changes land unannounced.

---

## How to upgrade across a major

When a new major ships:

1. Read the CHANGELOG entry for the new major. Every removal will have a `Removed` section with the migration path.
2. Pin to the previous major temporarily if you need time (`"^0.7.0"` before `1.0` lands; `"^1.0.0"` after).
3. Run your test suite against both versions during the transition.
4. The previous major enters maintenance for at least 6 months after the new major ships, so you have buffer time.

---

## What we commit to NOT change without warning

These are the strongest stability guarantees -- changes here always come with major bumps and full deprecation cycles:

- The shape of `error_code` strings in `UnfoldApiError.toPayload()`. Agents branch on these; renaming them silently would be cruel.
- The presence and shape of `warnings` arrays in successful responses.
- The discriminator field name `assessment_type` on `AssessmentInput`.
- The names of existing `schema_version` values (`"v1"` is forever `"v1"`).
- The set of fields required to call any tool. Required fields can be relaxed to optional in a minor; making an optional field required is breaking.

---

## What we may change in a minor

These are softer surfaces; partners should be prepared for additive changes without breaking:

- Tool descriptions. We may refresh wording, add CHAINING / TYPED ERRORS sections, etc. Description changes never alter semantics.
- The set of `error_code` strings (additions only). Agents that branch on known codes and have a default branch handle this gracefully.
- The set of `code` strings in `warnings` (additions only).
- New optional fields on tool inputs.
- New fields on tool outputs (your TS code ignores unknown fields).
- New tools entirely.

---

## What we treat as patches

- Bug fixes that bring the implementation back in line with the documented behaviour.
- Internal refactors that do not change the wire shape.
- Documentation-only fixes in tool descriptions (clarifications, typo fixes).

---

## Reporting issues

If a package upgrade breaks something that should not have, file an issue at https://github.com/Unfold-it/unfoldit-mcp-server/issues with:

- Your previous package version and the new package version.
- The tool name and approximate input.
- The error you saw or behaviour change.

We treat unexpected breakage on a minor version as a bug, not a "your integration is wrong" situation. Fixes go out as patches.

---

## Related docs

- [CHANGELOG.md](../../CHANGELOG.md) -- the source of truth for what changed when.
- [ASSESSMENT_TO_PLAN_MCP.md](./ASSESSMENT_TO_PLAN_MCP.md) -- the canonical integration walkthrough.
- [ASSESSMENT_PAYLOAD_CONVENTION.md](./ASSESSMENT_PAYLOAD_CONVENTION.md) -- legacy `unfold_assessment` envelope (superseded; preserved for partners on the old path).
