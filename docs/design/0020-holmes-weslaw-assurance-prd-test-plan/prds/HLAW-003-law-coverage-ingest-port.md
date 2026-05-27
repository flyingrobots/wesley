---
title: HLAW-003 LawCoverageIngestPort
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-003 LawCoverageIngestPort

## Feature Overview & Objectives

### Problem Statement

Wesley can report profile/category-aware law coverage, but Holmes needs one
ingest boundary that turns that report into gate-ready evidence. Coverage is
not a generic percentage: missing law for release-required mutation footprints
has a different posture than missing optional documentation law. If coverage
handling is left to renderers, CI and GitHub comments will disagree.

`LawCoverageIngestPort` validates Wesley coverage reports and normalizes
profile/category data into missing-subject evidence for later gate evaluation.

### Target User/Audience

- Release maintainers enforcing law coverage thresholds.
- QA engineers designing coverage fixture matrices.
- Holmes policy developers mapping coverage gaps to pass, warn, fail, or
  unavailable outcomes.
- Reviewers who need concrete missing subjects instead of abstract percentages.

### Success Metrics

| KPI | Target |
| --- | --- |
| Missing-subject traceability | 100% of failed required categories include concrete missing subject coordinates. |
| Profile separation | Local and release profile coverage can be ingested from the same report without overwriting each other. |
| Threshold readiness | 100% of ingested categories expose covered, total, missing, required, and advisory counts. |

## Scope Definition

### In Scope

- Accept `wesley.law-coverage/v1` JSON artifacts.
- Validate profile ids, category ids, required/advisory classification,
  numerator/denominator consistency, missing-subject arrays, and report hashes.
- Normalize coverage by profile and category for later policy evaluation.
- Preserve missing subject coordinates and the law category expected for each.
- Report absent coverage artifacts as unavailable input when the bundle marks
  coverage optional in local-only flows; required release flows are handled by
  later gate policy.

### Out of Scope

- Holmes will not scan GraphQL or `weslaw` files to compute coverage.
- Holmes will not decide which schema subjects require law coverage; Wesley and
  policy artifacts provide that information.
- Holmes will not apply final pass/warn/fail thresholds in this ingest slice.
- Holmes will not render coverage tables in this slice.
- Holmes will not create suppression or override behavior in this slice.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release maintainer, I want coverage reports normalized by profile so that release gates do not accidentally use local-dev posture. |
| US-002 | As a QA engineer, I want inconsistent coverage counts rejected so that tests cannot pass on impossible percentages. |
| US-003 | As a reviewer, I want missing subjects preserved with categories so that coverage failures are actionable. |
| US-004 | As a Holmes developer, I want coverage ingest to expose unavailable coverage distinctly from zero coverage so that later gates can render accurate outcomes. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A coverage report with `local-dev` and `ci-release` profiles | Holmes ingests the report | The normalized result contains separate profile maps with no merged thresholds. |
| US-002 | A category reports `covered: 7`, `total: 5` | Holmes ingests the report | Validation fails with `HLAW_COVERAGE_INCONSISTENT_COUNTS`. |
| US-002 | A category reports three missing subjects but `missing: 2` | Holmes ingests the report | Validation fails with `HLAW_COVERAGE_MISSING_COUNT_MISMATCH`. |
| US-003 | `ci-release` mutation footprint coverage is missing `operation:Mutation.createCheckpoint` | Holmes ingests the report | The normalized missing subject includes the exact coordinate and category id. |
| US-004 | The bundle has no coverage artifact in a local exploratory profile | Holmes validates inputs | Coverage is represented as unavailable, not as 0% covered. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Multi-profile coverage report | Happy | `fixtures/hlaw/law-coverage/multi-profile.json` | Separate normalized profile/category maps. |
| TS-002 | Perfect release coverage | Happy | `fixtures/hlaw/law-coverage/release-perfect.json` | No missing required subjects. |
| TS-003 | Missing mutation footprints | Negative | `fixtures/hlaw/law-coverage/missing-required-footprints.json` | Missing-subject evidence is preserved. |
| TS-004 | Covered count greater than total | Negative | `fixtures/hlaw/law-coverage/impossible-counts.json` | `HLAW_COVERAGE_INCONSISTENT_COUNTS`. |
| TS-005 | Unknown category id | Edge | `fixtures/hlaw/law-coverage/unknown-category.json` | Accepted only if report marks it advisory; otherwise rejected by policy later. |
| TS-006 | Empty categories array | Edge | `fixtures/hlaw/law-coverage/empty-categories.json` | Accepted as no coverage categories, not as full coverage. |
| TS-007 | Large coverage report across 50,000 subjects | Load | generated fixture | Ingest stays within performance budget. |

### Happy Path Testing

1. Load a valid coverage report with at least two profiles and four law
   categories.
2. Validate that every category exposes `covered`, `total`, `missing`, required
   status, and missing subject coordinates.
3. Confirm that release-required categories and advisory categories are retained
   separately.
4. Snapshot the normalized coverage result in deterministic profile/category
   order.

### Negative/Edge Case Testing

- Invalid inputs: malformed JSON, unsupported version, missing profile ids,
  duplicate profile ids, duplicate category ids within a profile, impossible
  counts, missing subject count mismatch, non-coordinate missing subjects, and
  invalid percentage precision.
- Timeouts: coverage ingest does not perform slow IO; adapter timeouts are input
  errors from artifact loading.
- Concurrent users or retries: repeated ingest of the same bytes must return the
  same category order and count calculations.
- Broken dependencies: absent coverage artifact is represented as unavailable
  only when the surrounding bundle and profile allow that state.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Ingest 50,000 subject rows in under 1 second after bytes are loaded. | Benchmark generated coverage reports with deterministic sorted output. |
| Load | Coverage normalization must not duplicate missing-subject strings more than necessary. | Allocation checks over large missing-subject fixtures. |
| Security | Subject coordinates are treated as opaque strings and never used as paths. | Include path-like coordinates and assert no filesystem access. |
| Accessibility | Later renderers must be able to show missing subjects as text, not only percentage color. | Contract test that missing subject arrays are always present for gaps. |
