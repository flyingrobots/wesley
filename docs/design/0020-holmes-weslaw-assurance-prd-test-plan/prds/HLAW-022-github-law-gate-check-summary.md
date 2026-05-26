---
title: HLAW-022 GitHubLawGateCheckSummary
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-022 GitHubLawGateCheckSummary

## Feature Overview & Objectives

### Problem Statement

PR reviewers need a compact GitHub-facing gate summary that distinguishes pass,
warn, fail, and unavailable law assurance states. The summary should explain
whether failures are validation failures, coverage gates, traceability gates, or
policy warnings. It should not be confused with GitHub branch protection rules,
which are configured outside Holmes.

### Target User/Audience

- Reviewers scanning PR readiness.
- CI maintainers deciding how Holmes output maps to required checks.
- Holmes GitHub adapter developers.
- QA engineers testing stale evidence and blocked-merge wording.

### Success Metrics

| KPI | Target |
| --- | --- |
| Summary clarity | 100% of summaries name primary blocking reason when state is fail or unavailable. |
| Gate fidelity | Gate states are copied from Holmes assessment, not recomputed in GitHub adapter. |
| Stale evidence detection | Stale or mismatched bundle evidence is highlighted before other advisory notes. |

## Scope Definition

### In Scope

- Define summary fields for GitHub comment and future check-run body: conclusion,
  state label, primary reason, gate counts, failed gates, warning gates,
  unavailable gates, validation status, and stale evidence flag.
- Define wording for pass, warn, fail, unavailable, and validation-failed
  summaries.
- Define stale evidence summary from traceability gate details.
- Define required-versus-advisory gate presentation.

### Out of Scope

- No creation of GitHub Checks.
- No branch protection mutation.
- No override controls beyond displaying current state.
- No rerun trigger.
- No GitHub annotation line mapping.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a reviewer, I want one sentence explaining whether law assurance is pass, warn, fail, or unavailable. |
| US-002 | As a CI maintainer, I want failed required gates separated from advisory warnings. |
| US-003 | As a release maintainer, I want stale evidence called out before semantic findings. |
| US-004 | As a QA engineer, I want each state covered by snapshots. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | All gates pass | Holmes builds GitHub summary | State is `pass` and primary reason says required law gates passed. |
| US-002 | Advisory warnings exist but required gates pass | Holmes builds summary | State is `warn` with required gate count passing. |
| US-002 | A required coverage gate fails | Holmes builds summary | State is `fail` and failed required gate count is nonzero. |
| US-003 | Traceability gate fails from stale law diff | Holmes builds summary | Primary reason names stale evidence and artifact role. |
| US-004 | Validation failed before assessment | Holmes builds summary | State is `fail` with validation failure wording, not gate failure wording. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | All pass | Happy | passing report | Pass summary. |
| TS-002 | Warning-only | Happy | advisory warning report | Warn summary. |
| TS-003 | Required gate failure | Negative | failed coverage report | Fail summary. |
| TS-004 | Traceability stale evidence | Negative | failed traceability report | Stale evidence primary reason. |
| TS-005 | Validation failure | Negative | validation result only | Validation failure summary. |
| TS-006 | Unavailable required evidence | Edge | unavailable required gate | Unavailable or fail according to policy. |

### Happy Path Testing

1. Build summaries from pass and warn report fixtures.
2. Assert state labels, counts, and primary reasons.
3. Verify required and advisory counts are separated.
4. Snapshot renderer-neutral summary JSON.

### Negative/Edge Case Testing

- Invalid inputs: no gates and no validation result, conflicting verdict and
  gate counts, unknown gate state, missing primary failed gate, and stale flag
  without mismatch details.
- Timeouts: summary construction is CPU-only and uses no GitHub calls.
- Concurrent users or retries: summary output is pure for the same report.
- Broken dependencies: GitHub publishing failure is not part of summary state.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Build summary in under 10 ms for 1,000 gates. | Synthetic gate benchmark. |
| Load | Gate counts scale without row rendering. | Large gate fixture. |
| Security | Summary strings escape untrusted gate names in renderers. | Crafted gate id fixtures. |
| Accessibility | State label and primary reason are text fields. | Contract test non-color summary fields. |
