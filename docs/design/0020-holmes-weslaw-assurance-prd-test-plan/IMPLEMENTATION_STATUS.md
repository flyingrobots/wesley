# Holmes `weslaw` Implementation Status

Date: 2026-06-01.

Status: **25 / 90 implementation slices closed**.

This note tracks Rust Holmes implementation progress against the completed
`0020` PRD/test-plan packet. The packet remains the planning source of truth;
this file records execution drift discovered while implementing the first
assurance substrate.

## Closed Implementation Surface

`HIMP-001` through `HIMP-015` established the unpublished
`crates/wesley-holmes` Rust crate, the domain/application/ports boundary, the
deterministic diagnostic envelope, artifact-family versioning, evidence bundle
validation, artifact location, and the first local validation gate.

`HIMP-016` through `HIMP-025` now add the first assessment-ready evidence
substrate:

- `LawDiffIngestPort` accepts `wesley.law-diff/v1`, validates hash anchors and
  event identities, and exposes normalized `lawDiff.changes[n]` event refs.
- `LawCoverageIngestPort` accepts `wesley.law-coverage/v1`, validates aggregate
  and per-category counts, normalizes missing subjects, and records omitted
  display counts.
- `LawCapabilityIngestPort` accepts current `wesley.capability-report/v1`
  output and the planned `wesley.law-capabilities/v1` alias, preserving
  report-only/runtime posture without claiming enforcement.
- `ContractBundleManifestIngestPort` accepts
  `wesley.contract-bundle-manifest/v1`, validates required hashes, compiler and
  codec metadata, and cross-checks manifest hashes against evidence-bundle
  provenance when supplied.
- `SemanticChangeFinding` turns normalized law diff events into stable Holmes
  finding ids, source refs, summaries, default severities, and full change
  payloads while preserving Wesley's original event kind.
- `LawCoverageGateDecision` evaluates normalized coverage against a minimal
  profile/category threshold policy and emits pass/warn/fail/unavailable
  decisions with boundary-value rounding and missing-subject truncation.

## Drift Check: HIMP-025

Decision: stop before `HIMP-026` and review drift.

No scope correction is needed for the main Holmes boundary. The implementation
still consumes Wesley-published artifacts and does not recompute semantic law,
schema shape, coverage, capability expansion, or contract bundle hashes.

The only observed contract drift is the law capability artifact name:

- The completed PRD names the artifact `wesley.law-capabilities/v1`.
- Current `wesley law capabilities --json` emits
  `wesley.capability-report/v1`.
- The Rust Holmes ingest port accepts both names for now and normalizes both
  into law capability evidence.

Follow-up before public report/CLI surfaces: decide whether the Wesley producer
should rename its API version to `wesley.law-capabilities/v1`, or whether the
PRD should bless `wesley.capability-report/v1` as the stable emitted artifact
name.

Recommended next implementation chunk after this drift check:

1. `HIMP-026` bundle traceability gate decision.
2. `HIMP-027` provenance report data structures.
3. `HIMP-028` gate aggregation rules.
4. `HIMP-029` omitted-detail accounting for large finding sets.
5. `HIMP-030` domain snapshot tests for findings, gate decisions, validation
   results, and provenance decisions.
