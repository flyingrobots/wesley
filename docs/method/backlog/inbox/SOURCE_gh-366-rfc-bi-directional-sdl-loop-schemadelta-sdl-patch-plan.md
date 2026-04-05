# GH-366 RFC: Bi-directional SDL loop (SchemaDelta -> SDL patch plan)

- Imported from: GitHub issue
- Issue: #366
- URL: https://github.com/flyingrobots/wesley/issues/366
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:46:25Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `feature`, `rfc`, `pkg:wesley-cli`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: manual override: bi-directional SDL loop is a source-authority problem.

## Original Issue

Pulse idea: treat GraphQL SDL as the canonical contract, generate runtime modules from it, and allow runtime observations to emit reviewable schema deltas back to an SDL patch (preventing drift).

## Problem
Over time, runtime behavior (indexes, nullability assumptions, policies, derived fields) drifts from the SDL unless there is an explicit loop for capturing and reviewing changes.

## Proposal
1) `schema.graphql` (SDL) is the source of truth.
2) Build pipeline: SDL -> stable IR -> codegen/runtime bundle.
3) Runtime (or adapters) can emit `SchemaDelta` proposals (never auto-mutating SDL).
4) `wesley patch` consumes deltas and produces an ordered patch plan + migration stubs.

## MVP (one evening)
- Read-only loop:
  - Define `SchemaDelta` enum with 2-3 variants: `AddIndex`, `SetDefault`, `RelaxNullability` (review-only).
  - Add `wesley patch --dry-run` that prints exact SDL diff it would apply.
  - Gate runtime emission behind `feature = emit-schema-deltas`.

## Safety rails
- Deltas are proposals only; SDL changes require explicit user approval.
- Hash boundaries: SDL hash -> IR hash -> codegen hash -> runtime bundle hash; log in build output.

## Acceptance criteria
- Given an SDL + a delta log, `wesley patch --dry-run` outputs a deterministic SDL diff.
- Applying the patch and rebuilding yields stable bundle hashes (when no semantic changes remain).

## Notes
This should dovetail with provenance semantics (`@tick`) but can land independently.
