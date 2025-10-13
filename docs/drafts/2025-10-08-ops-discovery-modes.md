# QIR Ops Discovery — Strict Directory by Default, Manifest Opt‑in

Status: Proposed (docs-first)

Owners: CLI, Data

> ⚠️ **Draft only** – this document captures the desired end-state. Unless explicitly noted as “Implemented”, items below are not yet available in the CLI.

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

- Inputs (Implemented)
  - `--ops <dir>`: required to enable ops compilation.
  - `--ops-schema <name>`: schema name for emitted SQL; defaults to `wes_ops`.
  - `--ops-allow-errors`: skip invalid ops locally; **blocked in CI unless `--i-know-what-im-doing` is also present**.
- Inputs (Planned)
  - `--ops-glob <pattern>`: default `**/*.op.json` (recursive). *Not implemented yet.*
  - `--ops-allow-empty`: allow empty discovery without error. *Not implemented yet.*
  - `--ops-explain`: emit EXPLAIN JSON snapshots per op. *Not implemented yet.*

- Discovery
  - Recursively scan `<dir>` for files matching `**/*.op.json` (future: honor `--ops-glob`).
  - Sort results using bytewise lexicographic order under the C/POSIX locale. Implementation MUST either force `LC_ALL=C` before sorting or use a locale-free comparator (e.g. `Buffer.compare`).
  - Add a regression test that runs discovery under `LC_ALL=en_US.UTF-8` and `LC_ALL=C` and asserts the sanitized compile order is identical; this guards against accidental locale leaks.
  - If 0 matches and `--ops-allow-empty` not set → exit `4` with a helpful hint.
  - No magic filename fallback: if the directory scan finds nothing, that's authoritative.

- Identifier policy
  - Lower-case op names and replace every character outside `[a-z0-9]` with `_`. If the sanitized result is empty, treat it as `unnamed`.
  - Measure identifier length in bytes (UTF-8). If the sanitized value exceeds 63 bytes, exit `3` (no truncation) and surface the offending identifier + file path.
  - Fail on collisions where two different files sanitize to the same base (list every colliding path, including the implicit `unnamed`).

- Output contract (deterministic)
  - `${outDir}/ops/<sanitized>.fn.sql` (always; `outDir` defaults to `out/`)
  - `${outDir}/ops/<sanitized>.view.sql` (only when the op defines zero input parameters; optional/defaulted params count as parameters → no view)
  - `${outDir}/ops.functions.sql` (aggregator for init/compose)
  - `${outDir}/tests-ops.sql` (pgTAP suite with existence + content assertions)
  - Optional `${outDir}/ops/explain/<sanitized>.explain.json` (planned `--ops-explain`)

- Validation & Exit semantics
  - Exit codes are numeric and stable: `0` success, `2` generic validation failure, `3` identifier collision or 63-byte overflow, `4` empty discovery without `--ops-allow-empty`, `5` Ajv/schema failures when `--ops-allow-errors` is absent.
  - Ajv schema errors → skip that op; aggregate and exit 5 unless `--ops-allow-errors`.
  - Discovery empty without `--ops-allow-empty` → exit 4.
  - Identifier collision or 63-byte overflow → exit 3 with a detailed list of colliding files.
  - Invoking `--ops-allow-errors` while `CI=true` produces exit 2 (`OPS_ALLOW_ERRORS_FORBIDDEN`) unless `--i-know-what-im-doing` is also passed (implemented guard).

### Mode B — Manifest (Future Work)

> Not implemented. This section captures the desired manifest mode for future phases; current CLI builds ignore `--ops-manifest`.

Activated when `--ops-manifest <path>` is supplied. Provides curated control.

- Manifest schema (proposal)

```json
{
  "$id": "https://wesley.dev/schemas/ops-manifest.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "description": "Curated ops discovery manifest for Wesley CLI",
  "additionalProperties": false,
  "properties": {
    "include": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "description": "Glob pattern relative to the manifest directory"
      },
      "description": "Set of globs to include"
    },
    "exclude": {
      "type": "array",
      "items": {
        "type": "string",
        "description": "Glob pattern relative to the manifest directory"
      },
      "description": "Globs to subtract after include (optional)"
    },
    "allowEmpty": {
      "type": "boolean",
      "default": false,
      "description": "Permit an empty result set without error"
    },
    "explain": {
      "type": "boolean",
      "default": false,
      "description": "Emit EXPLAIN JSON snapshots for compiled ops"
    }
  },
  "required": ["include"]
}
```

Example manifest:

```json
{
  "include": ["ops/**/*.op.json"],
  "exclude": ["ops/archive/**"],
  "allowEmpty": false,
  "explain": true
}
```

- Semantics
  - Expand `include` globs relative to the manifest file's directory; `--ops` is ignored in manifest mode. Apply `exclude` afterward, then sort via the same bytewise comparator as Mode A.
  - `allowEmpty` (default false) controls empty set behavior.
  - `explain` toggles EXPLAIN JSON emission.
  - If both manifest and `--ops-glob`/`--ops-explain` are supplied, manifest takes precedence.

## CLI Flags

Implemented today:
- `--ops <dir>` (enable ops compilation)
- `--ops-allow-errors` (compile others even if some fail Ajv; exit 0). **Do not use in CI**; when `CI=true` the CLI ignores this flag unless `--i-know-what-im-doing` is also supplied.
- `--i-know-what-im-doing` (opt-in override for hazardous flags in CI; required alongside `--ops-allow-errors` when `CI=true`)
- `--out-dir <dir>` (base output directory; defaults to `out/`)
- `--ops-schema <name>` (override emitted SQL schema; defaults to `wes_ops`)

Planned (not yet implemented):
- `--ops-glob <pattern>` (default `**/*.op.json`)
- `--ops-allow-empty`
- `--ops-explain`
- `--ops-manifest <path>`
- `--log-format <text|json>`

## Logging (examples)

```json
{"level":30,"time":1728439323456,"name":"Wesley","cmd":"generate","code":"OPS_DISCOVERY","ordinal":1,"total":3,"sanitized":"alpha","file":"example/ops/Alpha.op.json","schema":"wes_ops","msg":"ops: compiled operation"}
{"level":40,"time":1728439323567,"name":"Wesley","cmd":"generate","code":"OPS_IDENTIFIER_TOO_LONG","file":"example/ops/too_long.op.json","sanitized":"op_super_long_identifier","bytes":72,"limit":63,"msg":"Sanitized op name \"op_super_long_identifier\" from example/ops/too_long.op.json exceeds PostgreSQL identifier limit once prefixed (bytes=72, limit=63)"}
```

> JSON output shown above comes directly from pino when the CLI runs with default logging.

## Migration Plan

1) Compat (current state)
   - Keep existing behavior but deprecate hard-coded fallbacks with a warning when used.

2) Default Strict (planned)
   - Remove hard-coded fallbacks entirely.
   - Add planned flags (`--ops-glob`, `--ops-allow-empty`, `--ops-explain`).
   
3) Manifest (future)
   - Support `--ops-manifest` + publish `schemas/ops-manifest.schema.json`.

## Test Plan

- Unit
  - Glob expansion, sort order, 0‑match error, allow‑empty path.
  - Sanitization collision detection, 63‑char enforcement.
  - Ajv error aggregation with non‑zero exit.

- CLI bats
  - `--ops` on empty dir → failure (current behavior).
  - Name collision sample → failure.
  - CI guard: invoking `wesley generate --ops --ops-allow-errors` with `CI=true` must fail unless `--i-know-what-im-doing` accompanies it.
  - Ops schema override: `--ops-schema custom_schema` emits SQL objects under `custom_schema`.
  - Future: add tests for planned flags when implemented.

- CI (compose)
  - Aggregated `ops.functions.sql` applies cleanly.
  - `tests-ops.sql` content checks pass with seeded data.

## Rollout & Docs

- README “Using --ops”: document strict discovery (current) and add planned flag usage once implemented.
- qir-ops guide: add a “Discovery Modes” section and link this draft.
- Publish `schemas/ops-manifest.schema.json` in a follow-up when implementing manifest.

## Open Questions

- Should the `--i-know-what-im-doing` escape hatch remain long-term, or be dropped before GA?
- Should manifest support per‑op overrides (e.g., force view emission)? (out of scope for MVP)
