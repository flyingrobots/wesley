---
title: HLAW-004 LawCapabilityIngestPort
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-004 LawCapabilityIngestPort

## Feature Overview & Objectives

### Problem Statement

Wesley can emit report-only footprint capability summaries from `weslaw`
operation footprint law. Holmes must consume those summaries as architectural
posture evidence without overstating runtime enforcement. The risk is wording
and data drift: a report that says an operation "forbids Diagnostics" must not
claim the runtime physically prevented access unless a later runtime witness
proves enforcement.

`LawCapabilityIngestPort` validates report-only capability summaries and
normalizes reads, writes, creates, forbids, slots, closures, and enforcement
posture for later reporting.

### Target User/Audience

- Holmes report authors presenting operation footprint posture.
- Wesley maintainers ensuring `weslaw` footprint summaries are not
  misrepresented.
- Runtime maintainers evaluating which operations still lack enforcement
  witnesses.
- QA engineers testing empty, large, and malformed footprint summaries.

### Success Metrics

| KPI | Target |
| --- | --- |
| Wording safety | 100% of normalized summaries expose `reportOnly` or `runtimeEnforcement` explicitly. |
| Footprint fidelity | Supported reads, writes, creates, forbids, slots, and closures are preserved without reinterpretation. |
| Empty-footprint clarity | Operations without footprint law are reported as unavailable or absent, not as unrestricted access. |

## Scope Definition

### In Scope

- Accept `wesley.law-capabilities/v1` JSON artifacts.
- Validate operation subject, law id, report-only posture, runtime enforcement
  flag, resource arrays, slot declarations, closure declarations, and source
  artifact references.
- Normalize operation capability summaries for later report sections and gates.
- Require explicit posture fields so renderers cannot imply enforcement by
  omission.
- Define empty-footprint behavior for operations with no law, no capability
  summary, or explicit empty resource sets.

### Out of Scope

- Holmes will not generate runtime capability APIs.
- Holmes will not enforce reads, writes, creates, or forbids at runtime.
- Holmes will not inspect handler code to verify resource access.
- Holmes will not compute footprint closure expansion.
- Holmes will not publish capability summaries to GitHub in this slice.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a reviewer, I want Holmes to label capability summaries as report-only so that I do not mistake footprint law for runtime enforcement. |
| US-002 | As a runtime maintainer, I want operations grouped with reads, writes, creates, and forbids so that enforcement gaps are visible. |
| US-003 | As a QA engineer, I want malformed capability summaries rejected so that reports do not hide missing posture fields. |
| US-004 | As a Holmes developer, I want explicit empty-footprint semantics so that absent law is not rendered as unrestricted permission. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A capability summary has `reportOnly: true` and `runtimeEnforcement: false` | Holmes ingests it | The normalized summary exposes both fields and a wording hint requiring report-only language. |
| US-001 | A summary omits both posture fields | Holmes ingests it | Validation fails with `HLAW_CAPABILITY_MISSING_POSTURE`. |
| US-002 | An operation summary lists reads, writes, creates, and forbids | Holmes ingests it | The normalized operation retains every resource list in deterministic order. |
| US-003 | A resource appears in both `writes` and `forbids` for the same operation | Holmes ingests it | Validation fails with `HLAW_CAPABILITY_CONTRADICTORY_RESOURCE_POSTURE`. |
| US-004 | An operation is absent from the capability artifact | Holmes reports capability posture later | The operation is unavailable for capability reporting, not marked as empty access. |
| US-004 | An operation is present with all resource arrays empty | Holmes ingests it | The summary is accepted only if the artifact explicitly marks the operation as intentionally empty. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Report-only footprint summary for jedit replace operation | Happy | `fixtures/hlaw/capabilities/jedit-replace-report-only.json` | Normalized operation capability. |
| TS-002 | Runtime-enforced capability summary from future witness | Edge | `fixtures/hlaw/capabilities/runtime-enforced.json` | Accepted with enforcement posture preserved. |
| TS-003 | Missing posture flags | Negative | `fixtures/hlaw/capabilities/missing-posture.json` | `HLAW_CAPABILITY_MISSING_POSTURE`. |
| TS-004 | Contradictory writes and forbids | Negative | `fixtures/hlaw/capabilities/contradictory-resource.json` | `HLAW_CAPABILITY_CONTRADICTORY_RESOURCE_POSTURE`. |
| TS-005 | Explicit empty operation | Edge | `fixtures/hlaw/capabilities/explicit-empty.json` | Accepted as intentionally empty. |
| TS-006 | Large footprint with many slots and closures | Load | generated fixture | Accepted with deterministic ordering. |
| TS-007 | Missing operation summary | Edge | bundle with no capability entry for requested operation | Later report sees unavailable, not empty. |

### Happy Path Testing

1. Load a valid `wesley.law-capabilities/v1` artifact.
2. Ingest operation summaries containing reads, writes, creates, forbids, slots,
   closures, and posture fields.
3. Verify deterministic sorting by operation subject and resource name.
4. Verify that report-only wording metadata is emitted for renderers.

### Negative/Edge Case Testing

- Invalid inputs: unsupported version, missing operation subject, missing law
  id, missing posture fields, both `reportOnly` and `runtimeEnforcement` true
  without a witness reference, contradictory resource posture, duplicate slot
  ids, and closure references to unknown slots.
- Timeouts: no network or handler inspection occurs during ingest; artifact
  load failures are returned by the locator.
- Concurrent users or retries: simultaneous ingest must not mutate shared
  resource registries or reorder summaries.
- Broken dependencies: absent capability artifacts are unavailable evidence,
  while malformed capability artifacts fail validation.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Ingest 5,000 operation summaries in under 750 ms after bytes are loaded. | Benchmark generated capability reports. |
| Load | Large resource arrays must be normalized without quadratic duplicate checks. | Use set-based duplicate detection and benchmark growth. |
| Security | Resource names are data, not code or filesystem paths. | Include shell-like resource names and assert no execution or path access. |
| Accessibility | Later renderers must receive explicit posture labels for screen-reader-friendly text. | Contract test for posture label fields on every normalized summary. |
