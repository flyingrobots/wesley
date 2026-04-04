# GH-417 feat(qir): real EXPLAIN snapshots for ops

- Imported from: GitHub issue
- Issue: #417
- URL: https://github.com/flyingrobots/wesley/issues/417
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:38:57Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `feature`, `work:integrity`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: manual override: real EXPLAIN snapshots are evidence artifacts even though they originate in QIR ops.

## Original Issue

## Work Type
`integrity`

## Hill Supported
An operator or maintainer can trust ops EXPLAIN artifacts because they come from a real PostgreSQL plan, not a placeholder JSON stub.

## Sponsor Actor
- Operator generating ops artifacts for review or debugging
- Maintainer relying on ops evidence to be truthful

## Playback
A maintainer runs `wesley generate --ops-explain real --dsn ...` and gets deterministic `EXPLAIN (FORMAT JSON)` snapshots for compiled ops, with clear failure behavior when PostgreSQL is unavailable.

## Problem
Wesley currently supports only `--ops-explain mock`, which emits EXPLAIN-shaped placeholder JSON. That keeps the artifact path alive, but it is still a truth gap in the ops pipeline.

## Proposed Change
- add a real EXPLAIN mode that captures `EXPLAIN (ANALYZE false, FORMAT JSON)` from PostgreSQL
- write snapshots to `out/ops/explain/<name>.explain.json`
- validate the basic snapshot structure
- fail clearly when PostgreSQL is unavailable instead of crashing or silently pretending

## Invariants
- EXPLAIN snapshots stay deterministic by avoiding ANALYZE timing data
- mock mode can remain available as an explicitly fake path until fully retired
- evidence and docs must distinguish real plans from placeholders

## Non-Goals
- adding live performance benchmarking in the same slice
- turning EXPLAIN into a visual product mode yet
- treating mock output as if it were equivalent to real plan evidence

## Acceptance / Tests
- `wesley generate --ops --ops-explain real --dsn <pg_url>` captures EXPLAIN JSON for each emitted op
- snapshots are deterministic
- PostgreSQL-unavailable failures are explicit and graceful
- at least one integration test round-trips SDL or op input to EXPLAIN snapshot
- mock mode behavior remains explicit and documented until removal
