---
title: HLAW-013 LawCoverageReportSection
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-013 LawCoverageReportSection

## Feature Overview & Objectives

### Problem Statement

Law coverage gate decisions need a report section that makes coverage gaps
actionable. A raw percentage is insufficient; reviewers need profile, category,
required/advisory status, thresholds, covered count, total count, missing
subjects, gate state, and omitted-missing-subject counts. The section must
distinguish unavailable coverage from passing coverage.

### Target User/Audience

- Release maintainers reviewing required law coverage.
- Local developers improving missing law coverage.
- CLI and GitHub renderers creating coverage tables.
- QA engineers testing thresholds, empty categories, and accessibility.

### Success Metrics

| KPI | Target |
| --- | --- |
| Missing-subject actionability | 100% of failing required rows include at least one missing subject or an omitted count. |
| State clarity | Coverage rows distinguish pass, warn, fail, and unavailable without color. |
| Profile fidelity | Section output always names the evaluated profile. |

## Scope Definition

### In Scope

- Define `LawCoverageReportSection` rows for profile/category gate decisions.
- Include columns: profile, category, required status, state, covered, total,
  percentage, warning threshold, failure threshold, missing subjects, omitted
  missing count, and evidence reference.
- Define empty-category and unavailable-coverage states.
- Define percentage rounding and display precision.
- Define accessibility requirements for text status and missing-subject lists.

### Out of Scope

- No coverage computation from schema or law artifacts.
- No threshold policy definition beyond consuming evaluated gate decisions.
- No GitHub check status integration.
- No suppression or override behavior.
- No final renderer-specific table formatting.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release maintainer, I want failing coverage rows to list missing subjects so that I know what law to add. |
| US-002 | As a local developer, I want advisory warnings shown separately from failures so that I can prioritize work. |
| US-003 | As a renderer author, I want normalized coverage row fields so that Markdown and JSON output agree. |
| US-004 | As an accessibility reviewer, I want text status labels so that coverage state does not depend on color. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A required category fails with missing subjects | Holmes builds the section | The row state is `fail` and includes missing subject coordinates. |
| US-002 | An advisory category is below warning threshold | Holmes builds the section | The row state is `warn`, required status is advisory, and failure text is not used. |
| US-003 | Coverage gate decisions are supplied in random order | Holmes builds the section | Rows are sorted by profile, required status, category, and state severity. |
| US-004 | A row is rendered by a non-color renderer | The renderer reads section data | The row contains text `stateLabel` and `requiredLabel`. |
| US-004 | Coverage evidence is unavailable | Holmes builds the section | The section includes an unavailable row with no percentage pretending to be 0%. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Passing release coverage | Happy | pass gate decisions | Rows state `pass`. |
| TS-002 | Required coverage failure | Negative | fail gate with missing subjects | Missing subjects included. |
| TS-003 | Advisory warning | Happy | warn gate decision | Advisory row state `warn`. |
| TS-004 | Unavailable coverage | Edge | unavailable gate decision | Unavailable row, no percentage. |
| TS-005 | Boundary percentage rounding | Edge | 2/3 coverage | Documented precision used. |
| TS-006 | Large missing subject list | Load | 50,000 missing subjects | Truncated display and omitted count. |

### Happy Path Testing

1. Build section from pass, warn, and fail gate decisions.
2. Verify row fields include profile, category, state labels, counts,
   thresholds, and evidence references.
3. Assert percentage rounding matches the documented precision.
4. Snapshot deterministic row ordering.

### Negative/Edge Case Testing

- Invalid inputs: gate decision missing profile, missing category, percentage
  inconsistent with counts after validation bypass, negative omitted count,
  invalid threshold ordering, and missing evidence reference.
- Timeouts: section construction is CPU-only and uses no filesystem or network.
- Concurrent users or retries: sorting and truncation must be stable under
  parallel construction.
- Broken dependencies: if coverage gate evaluation is skipped because evidence
  is invalid, the section records validation status rather than fabricating rows.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Build 1,000 coverage rows in under 100 ms. | Synthetic gate decision benchmark. |
| Load | Missing subject truncation must preserve total missing count. | Large missing-subject fixture. |
| Security | Subject coordinates are display data only. | Include path-like and Markdown-like coordinates. |
| Accessibility | Every row includes text state, category, and required labels. | Contract test renderer-neutral row fields. |
