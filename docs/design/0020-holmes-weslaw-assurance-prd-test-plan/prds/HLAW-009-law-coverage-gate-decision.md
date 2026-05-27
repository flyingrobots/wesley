---
title: HLAW-009 LawCoverageGateDecision
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-009 LawCoverageGateDecision

## Feature Overview & Objectives

### Problem Statement

Coverage evidence is only useful when Holmes can decide what it means for a
specific assurance profile. A local exploratory profile may tolerate advisory
coverage gaps, while a release profile may fail on missing mutation footprints
or custom scalar semantics. Holmes needs a gate model that evaluates normalized
coverage evidence against policy without recomputing coverage.

`LawCoverageGateDecision` defines pass, warn, fail, and unavailable outcomes for
law coverage profiles and categories.

### Target User/Audience

- Release maintainers deciding whether law coverage is sufficient to merge or
  release.
- Holmes policy developers specifying required categories and thresholds.
- CI maintainers mapping coverage gates to exit behavior.
- Reviewers who need missing-subject evidence attached to gate outcomes.

### Success Metrics

| KPI | Target |
| --- | --- |
| Gate specificity | 100% of failing coverage gates include profile, category, threshold, actual value, and missing subjects. |
| Profile correctness | Gates evaluate only the selected profile unless policy explicitly compares profiles. |
| Unavailable clarity | Missing coverage artifacts produce `unavailable`, not false pass or false fail without policy. |

## Scope Definition

### In Scope

- Define gate states: `pass`, `warn`, `fail`, and `unavailable`.
- Evaluate normalized coverage evidence against a policy input containing
  required categories, warning thresholds, failure thresholds, and missing
  subject display limits.
- Produce gate decisions with profile id, category id, actual counts,
  thresholds, missing subjects, evidence artifact reference, and rationale.
- Define behavior for absent coverage evidence, absent categories, empty
  categories, and percentage rounding.
- Preserve policy and evidence separation: policy decides posture, Wesley
  coverage report provides facts.

### Out of Scope

- No policy schema design beyond the minimal policy input shape needed by this
  gate.
- No CLI exit-code mapping in this slice.
- No suppression or override behavior.
- No GitHub check summary rendering.
- No coverage computation from schema or law source.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release maintainer, I want required coverage categories to fail when below threshold so that missing law cannot ship unnoticed. |
| US-002 | As a local developer, I want advisory coverage gaps to warn instead of fail so that exploratory runs remain useful. |
| US-003 | As a reviewer, I want gate decisions to include missing subjects so that failures are directly actionable. |
| US-004 | As a CI maintainer, I want absent coverage evidence represented explicitly so that workflow configuration errors are visible. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Release policy requires mutation footprint coverage at 100% and actual coverage is 95% | Holmes evaluates the gate | The decision is `fail` with missing mutation subjects listed. |
| US-002 | Local policy marks invariant coverage advisory with warning threshold 80% and actual coverage is 70% | Holmes evaluates the gate | The decision is `warn`, not `fail`. |
| US-003 | Coverage is below threshold with five missing subjects | Holmes emits the decision | The decision includes the missing subjects up to the policy display limit and records any omitted count. |
| US-004 | Coverage evidence is unavailable | Holmes evaluates coverage gates | The decision is `unavailable` unless policy explicitly treats unavailable coverage as failure. |
| US-004 | A required category is absent from the coverage report | Holmes evaluates the gate | The decision is `fail` or `unavailable` according to policy, with category absence called out. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Release profile full coverage | Happy | release-perfect coverage plus strict policy | Gate `pass`. |
| TS-002 | Release required gap | Negative | missing-required-footprints coverage | Gate `fail` with subjects. |
| TS-003 | Local advisory gap | Happy | local advisory coverage plus local policy | Gate `warn`. |
| TS-004 | Coverage unavailable | Edge | no coverage artifact | Gate `unavailable`. |
| TS-005 | Category absent | Edge | coverage report missing required category | Policy-specific fail/unavailable. |
| TS-006 | Percentage boundary at threshold | Edge | 99/100 with 99% threshold | Gate `pass`; 98/100 fails or warns per policy. |
| TS-007 | Huge missing-subject list | Load | 50,000 missing subjects | Decision truncates display but keeps counts. |

### Happy Path Testing

1. Load normalized coverage evidence and a minimal policy input.
2. Evaluate gates for a selected profile.
3. Verify pass/warn/fail/unavailable outcomes for representative categories.
4. Assert that decisions include evidence references and policy rationale.
5. Snapshot sorted gate decisions.

### Negative/Edge Case Testing

- Invalid inputs: unknown profile, policy threshold below 0 or above 100,
  warning threshold stricter than failure threshold where disallowed, missing
  required category, absent coverage evidence, and inconsistent normalized
  counts after validation bypass.
- Timeouts: gate evaluation is CPU-only and must not use wall-clock time.
- Concurrent users or retries: gate evaluation must be pure and deterministic
  for the same evidence and policy.
- Broken dependencies: if coverage evidence is invalid, this gate is not run;
  validation result owns that failure.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Evaluate 1,000 category gates in under 100 ms. | Synthetic normalized coverage benchmark. |
| Load | Missing-subject display truncation must avoid copying all subjects into summaries. | Large missing-subject fixture and allocation check. |
| Security | Policy names and category ids are treated as data, not file paths or commands. | Crafted string fixtures. |
| Accessibility | Gate decisions must include text status and rationale independent of color. | Contract test status, summary, and remediation fields. |
