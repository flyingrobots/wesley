---
title: HLAW-025 GitHubLawOverrideControls
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-025 GitHubLawOverrideControls

## Feature Overview & Objectives

### Problem Statement

Some advisory law warnings may need maintainers to acknowledge risk without
blocking a PR, but invalid evidence and non-overridable release failures must
remain blocked. Holmes needs a design for GitHub-visible override controls that
are explicit, auditable, and policy-bound. The controls must not hide findings
or create a backdoor around validation failures.

### Target User/Audience

- Maintainers acknowledging advisory law warnings.
- Release managers defining non-overridable gates.
- Reviewers auditing why a warning was accepted.
- QA engineers testing abuse-prevention and audit records.

### Success Metrics

| KPI | Target |
| --- | --- |
| Auditability | 100% of accepted overrides produce an audit record with actor, reason, finding/gate id, and timestamp source. |
| Safety | Validation failures and non-overridable gates cannot be overridden. |
| Visibility | Overridden warnings remain visible in comments and reports. |

## Scope Definition

### In Scope

- Define policy-controlled override eligibility for advisory findings and
  warning gates.
- Define GitHub surfaces: label, checkbox command, or explicit comment command
  as candidate interfaces for later implementation.
- Define required audit fields: actor, source, reason, target id, previous
  state, resulting state, timestamp, and policy profile.
- Define non-overridable categories: validation failure, malformed evidence,
  traceability failure where policy marks required, and failed required gates.
- Define drift checkpoint at HLAW-025.

### Out of Scope

- No implementation of GitHub labels, slash commands, or checkbox parsing yet.
- No branch protection integration.
- No permanent storage backend.
- No suppression of findings from reports.
- No override of Wesley semantic law classifications.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a maintainer, I want to acknowledge an advisory warning with a reason so that a PR can proceed while keeping an audit trail. |
| US-002 | As a release manager, I want required failures to be non-overridable so that invalid evidence cannot ship. |
| US-003 | As a reviewer, I want overridden warnings to remain visible so that risk is not hidden. |
| US-004 | As a QA engineer, I want override eligibility tested per policy profile. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A policy marks advisory coverage warning as overridable | Maintainer submits valid override with reason | Holmes records an audit candidate and marks warning acknowledged. |
| US-002 | Evidence validation failed | Maintainer attempts override | Holmes rejects override as non-overridable. |
| US-002 | Required traceability gate failed | Maintainer attempts override | Holmes rejects override unless policy explicitly allows a non-release profile exception. |
| US-003 | A warning is overridden | Holmes renders GitHub summary | The warning remains visible with acknowledged status and reason reference. |
| US-004 | Override has no reason | Holmes validates override | Override is rejected with missing-reason diagnostic. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Advisory warning override | Happy | warning gate plus valid override | Acknowledged warning and audit record. |
| TS-002 | Missing reason | Negative | override without reason | Rejected. |
| TS-003 | Validation failure override attempt | Negative | invalid evidence result | Non-overridable rejection. |
| TS-004 | Required gate override attempt | Negative | failed required gate | Rejected by default. |
| TS-005 | Expired override | Edge | override past expiration | Ignored or rejected per policy. |
| TS-006 | Duplicate override target | Edge | two overrides for same warning | Deterministic latest/duplicate policy. |

### Happy Path Testing

1. Evaluate advisory warning under a policy that allows acknowledgement.
2. Apply a valid override candidate from a fake GitHub actor.
3. Verify audit fields and acknowledged warning state.
4. Render summary showing the warning remains visible.

### Negative/Edge Case Testing

- Invalid inputs: missing actor, missing reason, unknown finding id, expired
  override, duplicate override, non-overridable validation failure, required
  gate failure, and profile mismatch.
- Timeouts: override evaluation uses injected clock and no wall-clock calls.
- Concurrent users or retries: duplicate override submissions must produce
  deterministic audit ordering.
- Broken dependencies: if GitHub actor identity is unavailable, override is not
  accepted.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Evaluate 1,000 override candidates in under 100 ms. | Synthetic override benchmark. |
| Load | Audit records remain append-only and sorted deterministically. | Large override fixture. |
| Security | Override reason is untrusted text and must be escaped later. | Injection reason fixture. |
| Accessibility | Acknowledged state includes text labels and reason reference. | Contract test summary fields. |
