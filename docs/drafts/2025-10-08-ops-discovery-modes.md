# QIR Ops Discovery — Strict Directory by Default, Manifest Opt‑in

Status: Proposed (docs‑first)

Owners: CLI, Data

Context
- Today, `--ops` discovery is best‑effort: we try to read a directory and then fall back to a couple of hard‑coded filenames. This can silently skip valid ops, create confusing success, and produce unstable output ordering.
- We recently added Ajv validation and emitted `ops.functions.sql` + `tests-ops.sql`. To keep this reliable, discovery must be predictable and fail loud on misconfig.

Goals
- Deterministic, explicit, reproducible discovery of `*.op.json` files.
- Clear failure modes (no silent skips), actionable errors, and stable output ordering.
- Keep a path for curated control when teams need it (manifest).

Non‑Goals
- Changing the QIR DSL itself (shape of `*.op.json`).
- Changing lowering/emission semantics beyond identifier safety and ordering.

## Modes

### Mode A — Strict Directory Contract (Default)

Activated when `--ops <dir>` is provided and no manifest is specified.

- Inputs
  - `--ops <dir>`: required to enable ops compilation.
  - `--ops-glob <pattern>`: defaults to `**/*.op.json` (recursive).
  - `--ops-allow-empty`: default `false`. If no files match → error unless this flag is present.
  - `--ops-explain`: also emit EXPLAIN JSON snapshots per op (writes to `out/ops/explain/`).

- Discovery
  - Recursively scan `<dir>` for files matching the glob.
  - Sort results lexicographically (POSIX/C), compile in that order.
  - If 0 matches and `--ops-allow-empty` not set → `VALIDATION_FAILED` with a helpful hint.

- Identifier policy
  - Sanitize op name once to a base identifier (lowercase, non‑alphanumeric → `_`, fallback `unnamed`, 63‑char guard).
  - Fail on collisions where two different files sanitize to the same base (list both paths and the colliding key).

- Output contract (deterministic)
  - `out/ops/<sanitized>.fn.sql` (always)
  - `out/ops/<sanitized>.view.sql` (paramless ops only)
  - `out/ops.functions.sql` (aggregator for init/compose)
  - `out/tests-ops.sql` (pgTAP suite with existence + content assertions)
  - Optional `out/ops/explain/<sanitized>.explain.json` (when `--ops-explain`)

- Validation & Exit semantics
  - Ajv schema errors → skip that op; aggregate and exit non‑zero unless `--ops-allow-errors`.
  - Discovery empty without `--ops-allow-empty` → non‑zero (`VALIDATION_FAILED`).
  - Identifier collision or 63‑char overflow → non‑zero (`VALIDATION_FAILED`).

### Mode B — Manifest (Opt‑in)

Activated when `--ops-manifest <path>` is supplied. Provides curated control.

- Manifest schema (proposal)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "include": { "type": "array", "items": { "type": "string" } },
    "exclude": { "type": "array", "items": { "type": "string" } },
    "allowEmpty": { "type": "boolean" },
    "explain": { "type": "boolean" }
  },
  "required": ["include"]
}
```

- Semantics
  - Expand `include` globs relative to `--ops <dir>` (or manifest directory if clearer), subtract `exclude`, sort.
  - `allowEmpty` (default false) controls empty set behavior.
  - `explain` toggles EXPLAIN JSON emission.
  - If both manifest and `--ops-glob`/`--ops-explain` are supplied, manifest takes precedence.

## CLI Flags (final shape)

- `--ops <dir>` (enable ops compilation)
- `--ops-glob <pattern>` (A only; default `**/*.op.json`)
- `--ops-allow-empty` (A & B controls empty set; default false)
- `--ops-explain` (A only; manifest’s `explain` controls B)
- `--ops-manifest <path>` (switch to manifest mode)
- `--ops-allow-errors` (compile others even if some fail Ajv; exit 0)

## Logging (examples)

```
ops: found 4 files under example/ops (glob: **/*.op.json)
ops: compiling (1/4) example/ops/products_by_name.op.json → sanitized: products_by_name
ops: ajv errors (2): /filters/0/param/type must match pattern …
ops: collision: sanitized key "orders_by_user" from multiple files: …/orders_by_user.op.json, …/orders-by-user.op.json
```

## Migration Plan

1) Compat (now)
   - Keep existing behavior but deprecate hard‑coded fallbacks with a warning when used.
   - Add flags: `--ops-glob`, `--ops-allow-empty`, `--ops-explain`, `--ops-manifest` (no breaking change yet).

2) Default Strict (next minor)
   - Remove hard‑coded fallbacks entirely.
   - Empty discovery without `--ops-allow-empty` → error.

3) Manifest (optional)
   - Support `--ops-manifest` + publish `schemas/ops-manifest.schema.json`.

## Test Plan

- Unit
  - Glob expansion, sort order, 0‑match error, allow‑empty path.
  - Sanitization collision detection, 63‑char enforcement.
  - Ajv error aggregation with non‑zero exit.

- CLI bats
  - `--ops` on empty dir → failure; with `--ops-allow-empty` → success.
  - Name collision sample → failure.
  - Manifest include/exclude → exact set compiled; explain snapshots written when enabled.

- CI (compose)
  - Aggregated `ops.functions.sql` applies cleanly.
  - `tests-ops.sql` content checks pass with seeded data.

## Rollout & Docs

- README “Using --ops”: note strict discovery by default; show `--ops-allow-empty` and `--ops-glob` usage.
- qir-ops guide: add a “Discovery Modes” section and link this draft.
- Publish `schemas/ops-manifest.schema.json` in a follow‑up when implementing manifest.

## Open Questions

- Do we allow `--ops-allow-errors` to succeed CI when some ops fail Ajv? (leaning yes for local dev; CI should keep default strict)
- Should manifest support per‑op overrides (e.g., force view emission)? (out of scope for MVP)

