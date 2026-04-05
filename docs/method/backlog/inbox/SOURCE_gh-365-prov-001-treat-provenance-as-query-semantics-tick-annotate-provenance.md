# GH-365 PROV-001: Treat provenance as query semantics (@tick + --annotate-provenance)

- Imported from: GitHub issue
- Issue: #365
- URL: https://github.com/flyingrobots/wesley/issues/365
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:46:24Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `feature`, `rfc`, `pkg:wesley-cli`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: manual override: provenance-as-query-semantics changes source/query meaning, not only evidence surfaces.

## Original Issue

Wesley pitch: GraphQL → Postgres where every query path is a causal path.

This issue tracks an RFC + initial implementation for making provenance first-class query semantics:

## Goals
- Allow querying a specific worldline/tick as a first-class input (no ambient time).
- Optionally return a proof/provenance object per selected field (or per object) that pins the causal chain.
- Keep results + proof replayable: same query + same vars + same tick => byte-identical result + proof.

## Proposed UX
- Directive: `@tick(at: Tick!)` (and possibly later `@tick(diff: ...)` as syntactic sugar).
- Compiler flag: `--annotate-provenance[=brief|lineage|cost]`.
- Output shape: for each field `foo`, emit `__proof_foo` sibling field (or a nested `__proof` object).

## MVP scope
- `@tick(at: ...)` supported at operation level.
- `--annotate-provenance=brief`: return `{ tick, digest }` for each requested object/field where feasible.
- Define minimal provenance table/view contract for Postgres emission (even if stubbed initially).
- Documentation: examples and invariants (determinism, no host clock).

## Non-goals (initially)
- Automatic schema evolution / deltas (tracked separately).
- Full lineage reconstruction for every SQL expression; start with a minimal chain and extend.

## Acceptance criteria
- A demo query against a toy schema can be executed at two different ticks and yields deterministic results.
- With provenance enabled, the proof output is stable across reruns at the same tick.
- Compiler emits a stable schema/IR hash in the build artifact for pinning.
