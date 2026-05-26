---
title: HLAW-042 HolmesWorkflowWeslawIntegration
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-042 HolmesWorkflowWeslawIntegration

## Feature Overview & Objectives

### Problem Statement

CI must assemble Wesley `weslaw` evidence and invoke Holmes law assurance in a
predictable order. The workflow integration must define job dependencies,
artifact paths, failure propagation, fork permissions, retry behavior, and
publishing posture before implementation starts. This prevents a future workflow
from mixing stale artifacts or publishing misleading comments on invalid
evidence.

### Target User/Audience

- GitHub Actions maintainers.
- Holmes CLI implementers.
- Release engineers configuring law assurance gates.
- QA engineers testing branch, fork, and artifact failure paths.

### Success Metrics

| KPI | Target |
| --- | --- |
| Dependency clarity | Workflow jobs declare evidence generation before Holmes assessment. |
| Artifact traceability | All Holmes inputs and outputs use documented artifact paths. |
| Fork safety | Untrusted fork PRs do not receive privileged publishing tokens. |

## Scope Definition

### In Scope

- Define planned GitHub Actions job flow: Wesley law validate/diff/coverage/
  capabilities, bundle assembly, Holmes validate, Holmes assess, Holmes report,
  artifact upload, optional PR comment publish.
- Define artifact path conventions under `.wesley/holmes-law/` or workflow
  artifact roots.
- Define failure propagation for evidence generation, validation, assessment,
  rendering, artifact upload, and publishing.
- Define branch/fork permission policy and read-only fallback.
- Define retry and stale artifact behavior.

### Out of Scope

- No workflow YAML implementation in this slice.
- No branch protection changes.
- No secret management implementation.
- No live GitHub artifact API tests.
- No sibling repo workflow edits.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CI maintainer, I want the workflow to generate Wesley law artifacts before Holmes runs so that assessment inputs are fresh. |
| US-002 | As a release engineer, I want failed validation to stop publishing readiness comments. |
| US-003 | As a security reviewer, I want fork PRs to avoid privileged comment publishing. |
| US-004 | As a QA engineer, I want workflow failure paths documented with expected job conclusions. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Wesley law artifact job succeeds | Holmes assessment job starts | It reads documented artifact paths and expected bundle hash. |
| US-002 | Holmes validation fails | Workflow continues to reporting | It uploads validation failure artifacts but does not publish pass/warn readiness. |
| US-003 | PR originates from untrusted fork | Workflow runs | Publishing step is skipped or runs read-only without secrets. |
| US-004 | Artifact upload fails after assessment | Workflow completes | Job reports artifact failure separately from assessment verdict. |
| US-004 | Retry reruns same SHA | Workflow runs | Stale artifact checks use current run artifacts, not old run artifacts. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Clean main-branch PR | Happy | workflow fixture | Generate, assess, report, publish. |
| TS-002 | Validation failure | Negative | malformed evidence | Upload validation artifact, no pass comment. |
| TS-003 | Failed gate | Negative | coverage failure | Assessment failure conclusion. |
| TS-004 | Fork PR | Security | fork event fixture | Publish skipped/read-only. |
| TS-005 | Artifact upload failure | Edge | fake upload failure | Artifact failure surfaced separately. |
| TS-006 | Retry stale artifact | Edge | rerun event fixture | Uses fresh artifact set. |

### Happy Path Testing

1. Simulate a clean PR workflow with generated Wesley law artifacts.
2. Assemble Holmes law evidence bundle.
3. Run validate, assess, report, artifact upload, and optional publish steps.
4. Assert job outputs and artifact paths match the documented contract.

### Negative/Edge Case Testing

- Invalid inputs: missing Wesley artifact, stale bundle hash, invalid bundle,
  failed coverage gate, artifact upload failure, comment publish failure,
  missing token, fork PR, and workflow retry.
- Timeouts: workflow step timeouts are classified by step and do not rewrite
  assessment verdict.
- Concurrent users or retries: workflow reruns use run-scoped artifact paths and
  idempotent comment markers.
- Broken dependencies: GitHub API outages affect publishing only when artifacts
  and assessment already succeeded.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | End-to-end law assurance workflow completes under the configured CI budget for large fixtures. | Workflow simulation with performance fixture. |
| Load | Artifact upload handles large report and witness artifacts within retention limits. | Large artifact upload fixture. |
| Security | Fork PRs never expose write tokens or local absolute paths in comments. | Event-permission fixture tests. |
| Accessibility | Published comments retain headings and text state labels. | Comment snapshot assertions. |
