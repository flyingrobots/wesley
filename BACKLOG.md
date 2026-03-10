# Backlog

> [!WARNING]
> Absorbed into `ROADMAP_2.md`.
> This file is retained for historical reference only.

Items tracked from PR reviews, retrospectives, and ongoing development.
Sorted by effort-vs-payoff: low-effort/high-payoff first, high-effort/lower-payoff last.

## Completed

- [x] Extract shared Ajv validator helper and `resolveRepoRoot()` utility (now `schemaValidator.mjs` in `@wesley/cli/framework`; consolidates 5+ commands)
- [x] Centralize `sanitizeIdentBase` 63-char truncation in `identifiers.mjs` and remove duplicate in `emit.mjs`
- [x] Replace `Buffer` usage in `Cursor.mjs` with `TextEncoder`/`btoa` for platform-agnostic `@wesley/core`
- [x] Add cursor edge-case tests: null/undefined/primitive inputs to `encodeCursor`/`decodeCursor`
- [x] Add complementary join diagnostics test proving qualified refs (`'a.id'`, `{table,column}` form) do not throw
- [x] Add LIKE and CONTAINS operator tests (positive + negative paths) mirroring existing IN/ILIKE cases

## Open

Ranked by **effort** (L/M/H) vs **payoff** (L/M/H).

### Do First (low effort, high payoff)

- [ ] **Schema twin drift detection** — CI check or pre-commit hook that normalizes `op.schema.mjs` (JS object) and diffs against `schemas/op.schema.json` to catch drift. The Ajv tests only validate the JS twin; this PR's two Codex-reported bugs were caused by exactly this kind of drift.
  - Effort: **L** · Payoff: **H** · Category: Infrastructure

- [ ] **Vendor Bats plugins** (`bats-support`, `bats-assert`, `bats-file`) into `test/vendor/` to eliminate transient CI clone failures.
  - Effort: **L** · Payoff: **H** · Category: Infrastructure

- [ ] **Consolidate RESERVED keyword set**: merge `emit.mjs` local copy into `identifiers.mjs`, update to PostgreSQL 16 fully-reserved list.
  - Effort: **L** · Payoff: **H** · Category: Refactoring

### Do Next (medium effort, high payoff)

- [ ] **Schema-aware `search_path` generation** — infer the optimal `SET search_path` from the IR's schema references instead of requiring `--ops-search-path` manually. Eliminates a footgun where the wrong search_path silently resolves the wrong table at runtime. Aligns with QIR Phase C translator work.
  - Effort: **M** · Payoff: **H** · Category: Feature

- [ ] **"Schema surface" integration test** that validates all generated JSON artifacts against their JSON schemas.
  - Effort: **M** · Payoff: **H** · Category: Testing

- [ ] **`--strict-ident` integration test** that round-trips all PostgreSQL 16 reserved keywords.
  - Effort: **M** · Payoff: **M** · Category: Testing

- [ ] **Negative-path cert tests**: wrong key type, missing key, corrupt SHIPME format.
  - Effort: **M** · Payoff: **M** · Category: Testing

### Park (medium effort, medium payoff)

- [ ] **Ajv → compiled validators at build time** — pre-compile JSON Schema validators into standalone JS files during the build step. Eliminates the ~30KB Ajv dependency from the CLI's critical path and makes validation ~10x faster. More relevant after Go Public when cold-start time matters to external users. Ajv is already a devDependency in core (for testing only); runtime stays Ajv-free regardless.
  - Effort: **M** · Payoff: **M** · Category: Infrastructure

- [ ] **`schemas/qir.schema.json` root self-reference** — uses `QueryPlan: { "$ref": "#" }` which may confuse external JSON Schema tooling (code generators, IDE validators). Consider introducing a named `$defs/QueryPlan` definition and referencing that instead.
  - Effort: **M** · Payoff: **M** · Category: Schema

### Defer (high effort, medium payoff)

- [ ] **"Wesley Explain" visual mode** — generate an interactive HTML page (like pgAdmin's EXPLAIN visualizer) from explain JSON snapshots. Could embed in the playground's browser environment for ops development feedback. Premature until real EXPLAIN snapshots land (currently mock-only per roadmap).
  - Effort: **H** · Payoff: **M** · Category: Feature
