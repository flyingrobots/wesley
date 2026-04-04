# GH-303 tests(qir): ops pgTAP harness (1–2h)

- Imported from: GitHub issue
- Issue: #303
- URL: https://github.com/flyingrobots/wesley/issues/303
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:38:57Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `tests`, `group:qir-phase-c`, `work:integrity`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

## Work Type
`integrity`

## Hill Supported
Maintainers can run a dedicated ops pgTAP harness instead of relying on ad hoc fixture scripts and future-intent README notes.

## Sponsor Actor
- Maintainer wiring the ops test lane
- CI guarding ops behavior

## Playback
A maintainer runs one supported harness that applies the example schema and generated ops artifacts, then executes the ops pgTAP assertions with parseable results.

## Problem
The repo has fixture SQL and example pgTAP snapshots, but it still lacks a first-class harness that treats ops pgTAP as a supported executable lane.

## Proposed Change
- add an ops pgTAP harness for the example pipeline
- make the harness parse and report results cleanly
- use that harness as the foundation for later CI or preflight gating

## Invariants
- harness behavior is deterministic
- emitted ops and test execution stay aligned
- the harness reports explicit failures instead of relying on implied fixture drift

## Non-Goals
- generating every per-op test shape in the same slice
- replacing broader PostgreSQL smoke infrastructure
- treating fixture existence as proof of execution

## Acceptance / Tests
- a supported harness runs pgTAP for compiled example ops
- outputs are parsed or summarized explicitly
- the harness is documented well enough to reuse in CI follow-on work
