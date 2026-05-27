---
title: HLAW-010 BundleTraceabilityGateDecision
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-010 BundleTraceabilityGateDecision

## Feature Overview & Objectives

### Problem Statement

Holmes must reject mixed evidence where law diff, coverage, capability, and
manifest artifacts come from different contract bundle hashes. Without a
traceability gate, a PR could combine a current manifest with stale coverage or
capability summaries, producing a plausible but false assurance result.

`BundleTraceabilityGateDecision` evaluates cross-artifact hash consistency
against the expected contract bundle hash family and produces pass, fail, or
unavailable outcomes before reports claim readiness.

### Target User/Audience

- Release maintainers who need confidence that all law evidence belongs to the
  same compiled contract bundle.
- CI maintainers preventing stale artifact reuse across jobs.
- Holmes report authors rendering provenance and mismatch callouts.
- QA engineers creating stale, mismatched, and unsupported manifest fixtures.

### Success Metrics

| KPI | Target |
| --- | --- |
| Stale evidence detection | 100% of mismatched required artifact hashes produce a failing traceability gate. |
| Bundle clarity | Passing gates name the bundle hash family used for all evidence. |
| Unsupported-version safety | Unsupported manifest or artifact versions prevent a pass outcome. |

## Scope Definition

### In Scope

- Define traceability gate states: `pass`, `fail`, and `unavailable`.
- Compare expected bundle hash, manifest bundle hash, and artifact-declared
  schema/law/profile/bundle hashes where available.
- Detect missing required hash anchors, mismatched schema hash, mismatched law
  hash, mismatched profile hash, mismatched bundle hash, unsupported manifest
  version, and artifact version mismatch.
- Produce decision details naming each artifact role, expected hash, actual hash,
  mismatch type, and source artifact reference.
- Define checkpoint playback expectations: replaying a saved validation input
  must reproduce the same traceability decision.

### Out of Scope

- Holmes will not recompute any hash from source artifacts.
- Holmes will not rebind law to a new schema hash.
- Holmes will not decide whether a mismatch can be waived; override policy is a
  later slice.
- Holmes will not fetch missing artifacts.
- Holmes will not publish the gate to GitHub in this slice.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release maintainer, I want Holmes to fail when law evidence artifacts reference different bundle hashes so that stale evidence cannot ship. |
| US-002 | As a CI maintainer, I want traceability gates to identify the exact mismatched artifact so that workflow wiring can be fixed quickly. |
| US-003 | As a reviewer, I want passing traceability gates to show the common schema, law, profile, and bundle hashes so that provenance is visible. |
| US-004 | As a QA engineer, I want replayed evidence checkpoints to produce identical traceability decisions so that audits are deterministic. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Law diff and coverage artifacts declare different `bundleHash` values | Holmes evaluates traceability | The gate decision is `fail` with both artifact roles named. |
| US-001 | The manifest omits a required release hash anchor | Holmes evaluates traceability | The gate decision is `fail` unless validation has already rejected the manifest. |
| US-002 | Capability summary has a stale `lawHash` | Holmes evaluates traceability | The mismatch detail names `lawCapabilities`, expected law hash, and actual law hash. |
| US-003 | All required artifacts share the expected hash family | Holmes evaluates traceability | The gate decision is `pass` and includes common schema, law, profile, and bundle hashes. |
| US-004 | A saved validation result is replayed with the same policy | Holmes evaluates traceability twice | Both decisions serialize to byte-identical JSON. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | All artifacts share hash family | Happy | `fixtures/hlaw/traceability/consistent-release.json` | Gate `pass`. |
| TS-002 | Law diff stale bundle hash | Negative | `fixtures/hlaw/traceability/stale-law-diff.json` | Gate `fail`, role `lawDiff`. |
| TS-003 | Coverage stale profile hash | Negative | `fixtures/hlaw/traceability/stale-coverage-profile.json` | Gate `fail`, role `lawCoverage`. |
| TS-004 | Capability summary missing optional hash in local mode | Edge | local minimal fixture | Gate `unavailable` or `pass` according to policy input. |
| TS-005 | Unsupported manifest version | Negative | unsupported manifest fixture | No pass outcome; validation or gate failure. |
| TS-006 | No expected bundle hash supplied | Edge | bundle without expected hash | Gate compares available manifest/artifact hashes and reports unavailable where insufficient. |
| TS-007 | Replay checkpoint | Happy | saved validation result JSON | Byte-identical gate decision across runs. |

### Happy Path Testing

1. Validate and normalize a clean release evidence bundle.
2. Evaluate traceability against the expected bundle hash.
3. Confirm every required artifact role reports the same schema, law, profile,
   and bundle hashes.
4. Serialize the decision twice and assert byte equality.
5. Confirm the decision carries artifact references for report linking.

### Negative/Edge Case Testing

- Invalid inputs: mismatched schema hash, law hash, profile hash, bundle hash,
  unsupported version, missing required hash, malformed hash after validation
  bypass, duplicate artifact role, and absent expected bundle hash.
- Timeouts: traceability evaluation is CPU-only and must not read files or use
  wall-clock time.
- Concurrent users or retries: evaluating the same normalized evidence in
  parallel must produce identical decision ids and ordering.
- Broken dependencies: invalid evidence prevents gate execution; partially
  unavailable optional evidence produces `unavailable` only when policy allows.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Compare hash families across 1,000 artifact references in under 50 ms. | Synthetic normalized evidence benchmark. |
| Load | Mismatch detail lists must be truncated for display while retaining machine-readable counts. | Large stale-artifact fixture. |
| Security | Hash strings are treated as data and validated by syntax before comparison. | Fixtures with malformed and injection-like hash strings. |
| Accessibility | Mismatch output must name expected and actual hash values in text. | Snapshot text gate summaries with color disabled. |
