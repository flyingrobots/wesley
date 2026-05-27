---
title: HLAW-011 LawAssuranceReportDocument
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-011 LawAssuranceReportDocument

## Feature Overview & Objectives

### Problem Statement

Holmes needs a renderer-neutral report document for `weslaw` assurance. The
document must collect semantic change findings, coverage gates, capability
posture, and bundle provenance without baking in Markdown, GitHub, terminal, or
MCP output decisions. Without a common report document, every output adapter
will invent its own section order, summary language, truncation behavior, and
machine-readable fields.

### Target User/Audience

- Holmes application developers composing law assurance assessments.
- CLI, GitHub, API, and MCP adapter authors rendering the same assessment.
- Reviewers who need stable section ids and summary metrics across surfaces.
- QA engineers snapshotting report structure independently from presentation.

### Success Metrics

| KPI | Target |
| --- | --- |
| Renderer parity | 100% of law assurance renderers consume the same `LawAssuranceReportDocument`. |
| Section determinism | Repeated assessments produce identical section ordering and ids. |
| Evidence traceability | Every section can reference the source validation result, artifact role, or gate decision that produced it. |

## Scope Definition

### In Scope

- Define `LawAssuranceReportDocument` as a structured, renderer-neutral document
  with title, report id, profile, summary metrics, sections, attachments,
  source bundle reference, generated-at clock value, and verdict placeholder.
- Define stable section ids for law diff, coverage, capabilities, bundle
  provenance, validation diagnostics, and gate summary.
- Define section ordering and attachment reference rules.
- Define a deterministic JSON representation suitable for snapshots and future
  audit witnesses.
- Define no-data behavior for empty law diffs, unavailable coverage, empty
  capabilities, and missing optional provenance.

### Out of Scope

- No Markdown, terminal, GitHub, or MCP rendering in this slice.
- No final CLI flags or file-writing behavior.
- No GitHub comment markers, annotations, or check-run integration.
- No suppression or override policy.
- No recomputation of Wesley law evidence.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CLI renderer, I want one report document so that text, JSON, and Markdown outputs share the same facts. |
| US-002 | As a GitHub publisher, I want stable section ids so that sticky PR comments can update sections predictably later. |
| US-003 | As a QA engineer, I want deterministic JSON so that report snapshots catch real behavior drift. |
| US-004 | As a reviewer, I want empty states explicitly represented so that absent evidence is not confused with passing evidence. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A valid assessment contains findings, gates, and provenance | Holmes builds the report document | The report contains separate sections for each domain area without renderer-specific Markdown. |
| US-002 | The same assessment is rendered twice | Holmes builds report documents | Section ids and ordering are byte-identical. |
| US-003 | A report contains attachments | Holmes serializes the report JSON | Attachment references are sorted by id and include role, media type, and path or URI. |
| US-004 | Law diff has zero events | Holmes builds the report document | The law diff section is present with explicit `noSemanticChanges` state. |
| US-004 | Coverage evidence is unavailable | Holmes builds the report document | The coverage section records `unavailable`, not `pass`. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Full assessment report | Happy | normalized findings, gates, provenance | Complete report with stable sections. |
| TS-002 | Empty law diff report | Happy | no-change diff evidence | Law diff section present with no-change state. |
| TS-003 | Unavailable coverage | Edge | validation result without coverage | Coverage section marked unavailable. |
| TS-004 | Duplicate section id construction | Negative | test-only malformed section list | Constructor rejects duplicate ids. |
| TS-005 | Large findings list | Load | 10,000 synthetic findings | Report builds within budget with summary counts. |
| TS-006 | Untrusted strings in summaries | Security | crafted law ids and subjects | Report stores data without pre-rendering HTML. |

### Happy Path Testing

1. Build a report document from a complete assessment fixture.
2. Assert the report contains summary, law diff, coverage, capability,
   provenance, and gate sections.
3. Serialize the report JSON twice and assert byte equality.
4. Verify every section references the evidence or gate that produced it.

### Negative/Edge Case Testing

- Invalid inputs: duplicate section ids, missing report id, missing profile,
  orphan attachment references, invalid verdict placeholder, and section data
  with no evidence reference.
- Timeouts: report construction is CPU-only and must not read files, call GitHub,
  or inspect wall-clock time directly; generated time comes from injected clock.
- Concurrent users or retries: report construction must be pure for identical
  assessment input and fake-clock value.
- Broken dependencies: renderer failures are out of scope and must not mutate
  the report document.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Build a 10,000-finding report in under 500 ms. | Synthetic report benchmark. |
| Load | Summary metrics must avoid duplicating full finding payloads. | Allocation check over large report fixture. |
| Security | Report data remains escaped-data-ready and never contains trusted HTML. | Inject Markdown/HTML strings and inspect serialized JSON. |
| Accessibility | Report structure must expose text labels and summaries for every section. | Contract test required labels independent of color or layout. |
