# Holmes `weslaw` Implementation Status

Date: 2026-06-05.

Status: **35 / 90 implementation slices closed**.

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
- `LawCapabilityIngestPort` accepts canonical `wesley.law-capabilities/v1`
  output and a pre-canonical `wesley.capability-report/v1` compatibility alias,
  preserving report-only/runtime posture without claiming enforcement.
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

The only observed contract drift was the law capability artifact name:

- The completed PRD names the artifact `wesley.law-capabilities/v1`.
- Earlier `wesley law capabilities --json` output emitted
  `wesley.capability-report/v1`.
- The producer now emits `wesley.law-capabilities/v1`.
- The Rust Holmes ingest port keeps accepting `wesley.capability-report/v1` as
  a legacy compatibility alias and normalizes it into canonical law capability
  evidence.

No follow-up is needed before public report/CLI surfaces unless we decide to
remove the legacy alias before publishing Holmes.

Recommended next implementation chunk after this drift check:

1. `HIMP-026` bundle traceability gate decision.
2. `HIMP-027` provenance report data structures.
3. `HIMP-028` gate aggregation rules.
4. `HIMP-029` omitted-detail accounting for large finding sets.
5. `HIMP-030` domain snapshot tests for findings, gate decisions, validation
   results, and provenance decisions.

## Closed Implementation Surface (continued)

`HIMP-026` through `HIMP-035` add the aggregate assessment substrate and the
first policy layer:

- `BundleTraceabilityGateDecision` cross-checks all four hash fields
  (schema, law, policy, bundle) between the evidence bundle provenance and the
  contract bundle manifest, emitting per-field pass/fail checks and a rolled-up
  gate state.
- `aggregate_law_assurance_assessment` folds validation diagnostics, semantic
  findings, coverage gate decisions, and the traceability gate into one
  `LawAssuranceAssessmentOutcome`. Failures dominate unavailable evidence;
  unavailable evidence dominates a clean pass.
- `bounded_finding_summary` tracks omitted finding counts by severity for
  large finding sets without truncating the audit record.
- `law_assurance_provenance_report` captures artifact paths, schema versions,
  sha256 fields, and manifest cross-reference data in a stable, serializable
  snapshot.
- `LawAssurancePolicySchema` loads and validates `holmes.law-assurance-policy/v1`
  JSON with strict unknown-field rejection.
- `normalize_law_assurance_policy` resolves profile selection, applies profile
  inheritance, and merges parent and child coverage thresholds and severity
  mappings. Rejects unknown profiles by name.
- `map_semantic_finding_severities` remaps finding severities by event-kind
  keys normalized from Wesley's original event identity without reclassifying
  the underlying kind or change posture.
- `LawCoverageGateDecision` now integrates with the policy coverage threshold
  layer for profile/category-aware pass/warn/fail/unavailable evaluation.
- Suppression records carry `id`, `target` (kind + selector), `reason`,
  `owner`, `created_on`, `expires_on`, `allowed_severities`, and `audit_tags`.
  `matching_suppressions_for_finding` returns active, unexpired suppressions
  for a given finding and evaluation date.
- `non_overridable_gates` is a first-class field on the normalized policy,
  naming gates that suppression cannot override.

## Drift Check: HIMP-035

Date: 2026-06-05.

All 70 tests pass. The domain boundary is clean: the architecture test
confirms no domain source file imports ambient adapter crates. `adapters/` and
`reporting/` are intentionally empty stubs awaiting HIMP-041+ and HIMP-061+
respectively. `ports/` carries all seven fake implementations
(`FixedClock`, `InMemoryArtifactStore`, `RecordingGithubPublisher`,
`InMemoryMcpResourceRegistry`, `StaticPolicyLoader`, `EchoReportRenderer`,
`RecordingCommandIo`).

No scope drift observed. The one previously-recorded compatibility alias
(`wesley.capability-report/v1` → `wesley.law-capabilities/v1`) remains
handled and no follow-up is needed before public surfaces.

Pre-condition for HIMP-036 is met: `non_overridable_gates` exists in the
normalized policy, suppression matching is implemented, and gate state values
are stable. HIMP-036 adds the enforcement layer that rejects suppression
application when the targeted gate is non-overridable or when evidence is
invalid — neither condition is currently checked.

**HIMP-036 is clear to start.**
