---
title: HLAW-033 LawCoverageThresholdPolicy
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-033 LawCoverageThresholdPolicy

## Feature Overview & Objectives

### Problem Statement

Law coverage gates depend on profile-specific thresholds by category. A release
profile may require 100% mutation footprint coverage, while local development
may only warn below 80%. Threshold policy must define pass/warn/fail behavior,
rounding, absent-category behavior, and unavailable-evidence posture in a way
that is deterministic and easy to test.

### Target User/Audience

- Release managers setting coverage requirements.
- Local developers interpreting advisory coverage gaps.
- Holmes gate evaluators applying thresholds.
- QA engineers testing boundary values and missing categories.

### Success Metrics

| KPI | Target |
| --- | --- |
| Boundary correctness | Threshold tests cover exact-boundary, one-below, and absent-category cases. |
| Profile specificity | Each profile can define category-specific warning and failure thresholds. |
| Missing-subject actionability | Failing threshold decisions preserve missing subject evidence. |

## Scope Definition

### In Scope

- Define threshold policy fields for category id, required/advisory status,
  warning threshold, failure threshold, unavailable behavior, absent-category
  behavior, precision, and display limit.
- Define percentage calculation and rounding rules.
- Define profile inheritance and category default behavior.
- Define pass/warn/fail/unavailable decision inputs for
  `LawCoverageGateDecision`.
- Define boundary-value test matrix.

### Out of Scope

- No coverage computation.
- No severity mapping outside coverage gates.
- No suppression or override.
- No GitHub rendering.
- No policy UI.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release manager, I want mutation footprint coverage to fail below 100% so that release-required operations have law. |
| US-002 | As a local developer, I want scalar semantic coverage to warn below a lower threshold so that local runs stay informative. |
| US-003 | As a QA engineer, I want exact rounding rules so that 99.995% does not behave differently across platforms. |
| US-004 | As a reviewer, I want absent categories called out instead of treated as 0% or 100% silently. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Release threshold is 100% and coverage is 99/100 | Holmes evaluates coverage | Gate fails and missing subjects are listed. |
| US-002 | Local warning threshold is 80% and coverage is 75% | Holmes evaluates coverage | Gate warns under local profile. |
| US-003 | Coverage ratio has repeating decimal | Holmes evaluates coverage | Percentage uses documented precision and deterministic rounding. |
| US-004 | Required category is absent | Holmes evaluates coverage | Gate state follows absent-category policy and records absence. |
| US-004 | Coverage evidence is unavailable | Holmes evaluates coverage | Gate state follows unavailable-evidence policy. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Exact pass threshold | Happy | 100/100 with 100% threshold | Pass. |
| TS-002 | One below failure threshold | Negative | 99/100 with 100% threshold | Fail. |
| TS-003 | Advisory warning threshold | Happy | 75/100 with 80% warn | Warn. |
| TS-004 | Boundary rounding | Edge | 2/3 with configured precision | Deterministic percentage. |
| TS-005 | Absent category | Edge | category missing | Policy-specific outcome. |
| TS-006 | Unavailable coverage | Edge | no coverage evidence | Policy-specific outcome. |

### Happy Path Testing

1. Load normalized policy with coverage thresholds.
2. Evaluate category coverage across release and local profiles.
3. Assert pass/warn/fail/unavailable states and missing subject preservation.
4. Snapshot boundary-value matrix outputs.

### Negative/Edge Case Testing

- Invalid inputs: threshold below 0 or above 100, warning threshold inconsistent
  with failure threshold, invalid precision, missing category id, unknown
  unavailable behavior, and duplicate category policy.
- Timeouts: threshold evaluation is CPU-only.
- Concurrent users or retries: percentage calculation and rounding are pure.
- Broken dependencies: invalid coverage evidence prevents threshold evaluation.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Evaluate 10,000 category thresholds in under 100 ms. | Synthetic coverage benchmark. |
| Load | Missing-subject display limit avoids large summary expansion. | Large missing-subject fixture. |
| Security | Category ids are data and never used as paths. | Crafted category id tests. |
| Accessibility | Decision output includes text status, actual percentage, and threshold. | Contract test decision fields. |
