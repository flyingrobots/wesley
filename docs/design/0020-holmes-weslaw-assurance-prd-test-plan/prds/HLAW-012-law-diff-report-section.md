---
title: HLAW-012 LawDiffReportSection
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-012 LawDiffReportSection

## Feature Overview & Objectives

### Problem Statement

Semantic law diffs are the main reviewer-facing signal for `weslaw` changes.
Holmes needs a dedicated report section that presents findings in review order
while preserving Wesley event kinds and machine-readable fields. The section
must avoid vague summaries such as "law changed" and instead name subject,
law id, event kind, severity, and changed fields.

### Target User/Audience

- PR reviewers evaluating semantic changes.
- Release maintainers looking for high-risk law weakening or footprint changes.
- GitHub and CLI renderers presenting concise diff tables.
- QA engineers verifying no-change, truncation, and sorting behavior.

### Success Metrics

| KPI | Target |
| --- | --- |
| Review specificity | 100% of rendered rows include law id, subject, event kind, and severity. |
| Sort stability | The same findings produce identical row order across renderers. |
| High-risk visibility | Weakening, removal, and footprint expansion events are explicitly countable. |

## Scope Definition

### In Scope

- Define `LawDiffReportSection` data shape inside `LawAssuranceReportDocument`.
- Define columns: severity, event kind, posture, subject, law id, summary,
  changed fields, source artifact reference, and optional source location.
- Define grouped summary counts by event kind, severity, subject kind, and
  high-risk classification.
- Define truncation policy for large event lists with omitted-row accounting.
- Define no-change behavior when no semantic law diff findings exist.

### Out of Scope

- No final Markdown table rendering.
- No GitHub annotations or inline comments.
- No severity remapping beyond consuming existing finding severity.
- No semantic diff computation.
- No suppression or reviewer acknowledgement.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a PR reviewer, I want semantic law changes grouped and sorted so that I can scan risk quickly. |
| US-002 | As a release maintainer, I want high-risk event counts so that weakening and removals are visible before merge. |
| US-003 | As a renderer author, I want table-ready row data so that terminal, Markdown, and JSON output stay consistent. |
| US-004 | As a QA engineer, I want large diffs truncated deterministically so that reports remain usable. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Findings include scalar, variant, footprint, and channel changes | Holmes builds the section | Rows are sorted by severity, subject kind, subject, law id, and event kind. |
| US-002 | Findings include a law removal and a weakening | Holmes builds the section | Summary counts include high-risk count `2` with event kinds preserved. |
| US-003 | A finding has source location metadata | Holmes builds the row | The row includes source artifact reference and location fields. |
| US-004 | Findings exceed display limit `100` | Holmes builds the section | The section includes the first deterministic 100 rows and an omitted count. |
| US-004 | Findings list is empty | Holmes builds the section | The section state is `noSemanticChanges` and contains zero rows. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Mixed findings section | Happy | mixed semantic findings | Sorted rows and grouped counts. |
| TS-002 | Empty findings | Happy | no findings | No-change state. |
| TS-003 | High-risk weakening/removal | Negative | weakening and removal findings | High-risk counts populated. |
| TS-004 | Long changed-fields list | Edge | footprint change with many resources | Row summary bounded, details preserved. |
| TS-005 | Large findings list | Load | 10,000 findings | Deterministic truncation and omitted count. |
| TS-006 | Crafted Markdown in law id | Security | malicious string fixture | Data preserved for renderer escaping. |

### Happy Path Testing

1. Build section from a mixed finding fixture.
2. Verify columns for severity, event kind, posture, subject, law id, summary,
   changed fields, and artifact reference.
3. Assert grouped counts and deterministic row order.
4. Snapshot JSON row output.

### Negative/Edge Case Testing

- Invalid inputs: missing finding id, missing subject, missing event kind,
  duplicate row id after finding normalization bypass, invalid display limit,
  and changed-fields payload that exceeds summary budget.
- Timeouts: section construction is CPU-only and uses no clocks or IO.
- Concurrent users or retries: deterministic row sorting must not depend on map
  iteration order.
- Broken dependencies: if finding construction failed, this section is not
  built; validation owns that failure.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Build and summarize 10,000 rows in under 300 ms. | Synthetic finding benchmark. |
| Load | Truncation must retain counts without rendering every row. | Large findings fixture. |
| Security | All row strings are untrusted and renderer-escaped later. | Injection-like law ids and subjects. |
| Accessibility | Rows expose text severity and event kind for non-color renderers. | Contract test required row labels. |
