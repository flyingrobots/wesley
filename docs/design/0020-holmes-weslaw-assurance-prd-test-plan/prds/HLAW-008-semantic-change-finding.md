---
title: HLAW-008 SemanticChangeFinding
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-008 SemanticChangeFinding

## Feature Overview & Objectives

### Problem Statement

Wesley law diff events need to become Holmes findings before they can be
rendered, gated, filtered, summarized, or published. The finding model must be
stable enough for snapshots and PR comments while preserving Wesley's semantic
classification. It must not invent new law meaning, and it must be traceable to
the source diff artifact.

`SemanticChangeFinding` defines the domain finding for law diff events, with
stable ids, severity posture, law id, subject, change payload, artifact
reference, and renderer-neutral summary fields.

### Target User/Audience

- Holmes domain developers implementing law assessment.
- Reviewers reading semantic change summaries.
- GitHub and MCP adapters that need stable finding ids.
- QA engineers asserting deterministic sorting and rendering inputs.

### Success Metrics

| KPI | Target |
| --- | --- |
| Stable identity | The same law diff event produces the same finding id across CLI, GitHub, MCP, and API flows. |
| Classification fidelity | 100% of findings preserve Wesley event kind and change posture without reclassification. |
| Renderer readiness | Each finding exposes summary, details, severity, subject, law id, and source artifact reference. |

## Scope Definition

### In Scope

- Define `SemanticChangeFinding` fields: finding id, law id, subject, event
  kind, change posture, severity, summary, details, source artifact reference,
  before/after hashes where available, profile, and tags.
- Define deterministic finding id derivation from bundle hash family, law id,
  subject, event kind, and event ordinal or event id.
- Define default severity mapping inputs while leaving policy override behavior
  to later policy slices.
- Define sort order by severity, subject kind, subject, law id, event kind, and
  event id.
- Define Markdown snippet and JSON rendering inputs without implementing final
  report sections.

### Out of Scope

- No policy-driven severity override in this slice.
- No GitHub annotation mapping in this slice.
- No final report document composition in this slice.
- No suppression, override, or review-state behavior.
- No recomputation of semantic diffs from source law files.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a reviewer, I want each semantic law change represented as a finding so that I can inspect it consistently across reports. |
| US-002 | As a GitHub publisher, I want stable finding ids so that updated comments do not duplicate findings across reruns. |
| US-003 | As a Holmes policy author, I want severity to be explicit but policy-adjustable later so that local and release profiles can differ. |
| US-004 | As a QA engineer, I want deterministic sort order so that snapshots are stable across platforms. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A law diff event reports a weakened scalar bound | Holmes constructs a finding | The finding preserves event kind, subject, law id, before/after fields, and source artifact reference. |
| US-002 | The same event is ingested twice from the same bundle hash family | Holmes derives finding ids | The finding id is identical across runs. |
| US-002 | The same law id appears in two distinct events | Holmes derives finding ids | The findings have distinct ids because event identity is included. |
| US-003 | Wesley supplies a severity hint | Holmes constructs a finding | The hint is preserved as input severity and marked as policy-adjustable later. |
| US-004 | Findings arrive in random JSON order | Holmes sorts them | Output order is deterministic by the documented sort key. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Weakened scalar law event | Happy | `fixtures/hlaw/law-diff/weakened-scalar.json` | One finding with preserved posture. |
| TS-002 | Footprint expanded event | Happy | `fixtures/hlaw/law-diff/footprint-expanded.json` | Finding includes resource delta fields. |
| TS-003 | Duplicate law id across separate events | Edge | `fixtures/hlaw/law-diff/repeated-law-id.json` | Distinct stable finding ids. |
| TS-004 | Random event order | Edge | shuffled mixed-event fixture | Stable sorted finding output. |
| TS-005 | Missing event id after ingest validation bypass in test | Negative | constructed invalid event | Finding constructor rejects input. |
| TS-006 | Long details payload | Load | event with large delta arrays | Summary remains bounded; details retain data. |
| TS-007 | Markdown-like law id or subject text | Security | crafted event strings | Treated as data for later escaping. |

### Happy Path Testing

1. Feed normalized law diff events into the finding constructor.
2. Verify one finding per event.
3. Assert stable id derivation over repeated runs.
4. Assert JSON rendering inputs include full traceability fields.
5. Assert Markdown snippet fields are plain data and not pre-rendered unsafe
   HTML.

### Negative/Edge Case Testing

- Invalid inputs: missing law id, missing subject, missing event kind, absent
  event identity, invalid severity hint, empty summary, and unsupported subject
  syntax after ingest validation bypass.
- Timeouts: finding construction is CPU-only and must not include IO or clocks.
- Concurrent users or retries: finding id derivation must be pure and safe under
  concurrent assessment.
- Broken dependencies: if source artifact reference is unavailable, finding
  construction requires an explicit unavailable reference object rather than
  null.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Construct and sort 10,000 findings in under 750 ms. | Benchmark synthetic normalized events. |
| Load | Large delta payloads must not be copied into multiple summary fields. | Allocation checks over footprint delta fixtures. |
| Security | Finding strings must be marked as untrusted data for renderers. | Fixtures with Markdown, HTML, and shell-like strings. |
| Accessibility | Each finding must include text severity and summary fields for non-color renderers. | Contract test required text fields. |
