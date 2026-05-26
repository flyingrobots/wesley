---
title: HLAW-002 LawDiffIngestPort
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-002 LawDiffIngestPort

## Feature Overview & Objectives

### Problem Statement

Wesley emits structured semantic law diff events, but Holmes needs an input port
that turns those events into assurance-ready findings without reinterpreting
their meaning. If every adapter reads `wesley.law-diff/v1` directly, event
ordering, unknown event kinds, duplicate law ids, and malformed JSON will drift
across CLI, GitHub, MCP, and API behavior.

`LawDiffIngestPort` is the application boundary that accepts Wesley law diff
JSON, validates the envelope, preserves Wesley's classification, and emits
stable Holmes finding candidates.

### Target User/Audience

- Holmes application-layer developers defining law assurance use cases.
- QA engineers building fixture coverage for semantic law change review.
- CI maintainers who need deterministic findings from Wesley law diff output.
- Review agents that need concise machine-readable findings with source
  artifact references.

### Success Metrics

| KPI | Target |
| --- | --- |
| Event fidelity | 100% of supported Wesley event kinds map without changing the original event kind. |
| Diagnostic determinism | Repeated ingest of the same diff produces identical finding ids and ordering. |
| Failure isolation | Malformed law diff input produces validation errors and zero assurance findings. |

## Scope Definition

### In Scope

- Define a `LawDiffIngestPort` that accepts `wesley.law-diff/v1` JSON artifacts.
- Validate version, producer identity, source/target hash fields, event array
  structure, event ids, law ids, subjects, event kind, and source spans where
  present.
- Normalize supported events into `SemanticChangeFinding` inputs while
  preserving Wesley event kind and severity hints.
- Reject malformed JSON, unsupported versions, duplicate event ids, missing
  required fields, and unknown event kinds unless policy explicitly permits
  opaque advisory passthrough in a later slice.
- Preserve source artifact path and byte offset metadata when the artifact
  locator supplies it.

### Out of Scope

- Holmes will not compute semantic law diffs.
- Holmes will not decide whether a scalar change is strengthening, weakening,
  or mixed.
- Holmes will not edit `weslaw` or GraphQL source files.
- Holmes will not render final Markdown reports in this slice.
- Holmes will not publish GitHub annotations in this slice.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a Holmes assessor, I want law diff events normalized into stable finding inputs so that later gates and reports share the same evidence. |
| US-002 | As a QA engineer, I want unknown event kinds rejected deterministically so that new Wesley event kinds cannot slip through silently. |
| US-003 | As a reviewer, I want each finding candidate to retain its law id, subject, and artifact reference so that I can trace it back to Wesley output. |
| US-004 | As a release maintainer, I want malformed law diff evidence to fail validation before readiness judgment so that bad inputs are not reported as product failures. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A valid `wesley.law-diff/v1` file with added, removed, modified, strengthened, and weakened events | The ingest port reads it | Holmes emits normalized finding inputs in deterministic review order. |
| US-001 | Two events share the same law id but have different event ids | The ingest port reads them | Both events are preserved, sorted by event ordering rules, and not deduplicated by law id. |
| US-002 | A diff event has `kind: "quantumLawShift"` | The ingest port reads it | Validation fails with `HLAW_DIFF_UNKNOWN_EVENT_KIND`. |
| US-002 | A diff file declares `version: "wesley.law-diff/v2"` | The ingest port reads it | Validation fails with `HLAW_DIFF_UNSUPPORTED_VERSION`. |
| US-003 | A diff event includes subject `operation:Mutation.replaceRangeAsTick` and law id `jedit.op.replaceRangeAsTick.footprint` | The ingest port normalizes it | The finding input contains the exact subject and law id strings from Wesley output. |
| US-004 | A diff artifact is malformed JSON | The ingest port reads it | The validation result records `HLAW_DIFF_MALFORMED_JSON` and emits zero findings. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Valid mixed event diff | Happy | `fixtures/hlaw/law-diff/mixed-events.json` | Supported events become finding inputs. |
| TS-002 | Empty diff | Happy | `fixtures/hlaw/law-diff/no-changes.json` | Accepted with zero finding inputs. |
| TS-003 | Unknown event kind | Negative | `fixtures/hlaw/law-diff/unknown-kind.json` | `HLAW_DIFF_UNKNOWN_EVENT_KIND`. |
| TS-004 | Duplicate event id | Negative | `fixtures/hlaw/law-diff/duplicate-event-id.json` | `HLAW_DIFF_DUPLICATE_EVENT_ID`. |
| TS-005 | Missing subject | Negative | `fixtures/hlaw/law-diff/missing-subject.json` | `HLAW_DIFF_MISSING_FIELD`. |
| TS-006 | Large diff with 10,000 events | Load | generated fixture | Accepted within budget and sorted deterministically. |
| TS-007 | Diff with source spans missing | Edge | `fixtures/hlaw/law-diff/no-spans.json` | Accepted with source location marked unavailable. |

### Happy Path Testing

1. Load a valid `wesley.law-diff/v1` fixture through the artifact locator.
2. Invoke `LawDiffIngestPort`.
3. Assert that each supported event kind maps to one normalized finding input.
4. Assert that Wesley fields are copied, not recomputed: event kind, law id,
   subject, before/after hashes, and semantic change payload.
5. Snapshot the sorted finding input list.

### Negative/Edge Case Testing

- Invalid inputs: malformed JSON, unsupported version, missing `events`, missing
  event `kind`, missing `lawId`, missing `subject`, duplicate event ids, wrong
  primitive types, and unknown event kinds.
- Timeouts: the port receives artifact bytes from an adapter; injected read
  timeout is surfaced by the artifact locator and not retried here.
- Concurrent users or retries: multiple simultaneous ingest calls over the same
  bytes must produce identical normalized results and no shared mutable state.
- Broken dependencies: invalid artifact metadata from the locator must produce
  an input error tied to the law diff artifact role.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Ingest 10,000 events in under 500 ms after bytes are loaded. | Benchmark generated event fixtures and assert stable sort cost. |
| Load | Memory use must scale linearly with event count. | Run heap or allocation checks over 100, 1,000, and 10,000 event fixtures. |
| Security | Event text must be escaped by later renderers; ingest must preserve raw strings without executing them. | Include Markdown and HTML-like payloads in fixtures and verify they remain data. |
| Accessibility | Finding inputs must carry enough fields for later renderers to produce non-color-only summaries. | Contract test that severity, kind, law id, subject, and summary are always available. |
