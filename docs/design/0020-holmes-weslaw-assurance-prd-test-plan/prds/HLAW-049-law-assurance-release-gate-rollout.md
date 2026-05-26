---
title: HLAW-049 LawAssuranceReleaseGateRollout
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-049 LawAssuranceReleaseGateRollout

## Feature Overview & Objectives

### Problem Statement

Law assurance should become a release gate gradually. If it is enabled as a hard
branch-protection requirement on day one, false positives and incomplete
fixtures can block useful work. If it remains advisory forever, semantic law
regressions will continue to slip through review. The rollout must define
advisory, required, and non-overridable phases with explicit promotion,
rollback, and false-positive handling rules.

### Target User/Audience

- Release managers deciding when Holmes law assurance blocks merges.
- CI maintainers updating branch protection and workflow requirements.
- Holmes implementers adding gate modes and diagnostics.
- Reviewers responding to advisory and required findings.
- Maintainers handling false positives without weakening semantic law.

### Success Metrics

| KPI | Target |
| --- | --- |
| Rollout clarity | Advisory, required, and non-overridable phases each have entry and exit criteria. |
| False-positive handling | Every false-positive path records evidence, owner, expiration, and rollback or suppression decision. |
| Branch protection readiness | Required checks and admin-override behavior are documented before enforcement. |

## Scope Definition

### In Scope

- Define rollout phases: local-only preview, advisory CI, required CI, and
  non-overridable release gate.
- Define promotion criteria for moving from one phase to the next.
- Define rollback criteria and emergency disable behavior.
- Define branch protection interactions, including check names, required
  statuses, admin override posture, and stale-check behavior.
- Define false-positive handling flow using suppression policy, issue tracking,
  expiration, and audit witness.
- Define communication artifacts required before enforcement.

### Out of Scope

- No branch protection changes are applied in this slice.
- No production rollout is executed.
- No bypass mechanism for invalid evidence or failed required non-overridable
  gates.
- No organization-wide policy outside Wesley.
- No live GitHub settings automation.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release manager, I want phased enforcement so that law assurance becomes blocking only after evidence quality is proven. |
| US-002 | As a CI maintainer, I want stable check names and branch-protection rules so that required gates are predictable. |
| US-003 | As a reviewer, I want advisory findings to show future blocking impact so that fixes happen before enforcement. |
| US-004 | As a maintainer, I want a false-positive process that preserves auditability and does not hide invalid evidence. |
| US-005 | As an admin, I want rollback criteria so that a broken gate can be disabled safely without erasing the incident trail. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Project is in advisory phase | Required law finding occurs | CI succeeds or warns according to policy, and report marks the finding as future-blocking. |
| US-001 | Promotion criteria are satisfied for the required phase | Release manager approves rollout | Required gate becomes a branch-protection candidate with documented check name. |
| US-002 | Required CI phase is active | Holmes emits required failure | Check conclusion is failure and branch protection can block merge. |
| US-003 | Advisory finding is rendered | Reviewer reads PR comment | Comment names severity, future phase impact, and remediation action. |
| US-004 | Maintainer claims false positive | Suppression process runs | Suppression requires id, owner, reason, evidence, expiration, and audit witness entry. |
| US-005 | Gate implementation produces widespread infrastructure failures | Rollback procedure runs | Gate returns to advisory or disabled mode with incident record and follow-up task. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Advisory required finding | Happy | advisory phase policy | Non-blocking check with future-blocking label. |
| TS-002 | Required phase failure | Negative | required phase policy | Failing check and blocking report. |
| TS-003 | Non-overridable invalid evidence | Negative | invalid evidence fixture | Cannot be suppressed or waived. |
| TS-004 | False-positive suppression | Edge | suppression with owner and expiration | Accepted and audited if policy permits. |
| TS-005 | Expired suppression | Negative | expired suppression fixture | Required finding reappears. |
| TS-006 | Rollback mode | Edge | rollback config | Gate downgrades to advisory and records incident id. |
| TS-007 | Stale branch protection check | Negative | stale commit SHA | Check marked stale and not reused for merge readiness. |

### Happy Path Testing

1. Run advisory policy over a fixture with one required finding.
2. Assert CI surface succeeds or warns while report marks future blocking impact.
3. Run required policy over the same fixture.
4. Assert check fails and branch-protection metadata names the required check.
5. Run non-overridable policy over invalid evidence.
6. Assert invalid evidence fails regardless of suppression or override inputs.

### Negative/Edge Case Testing

- Invalid inputs: unknown rollout phase, missing check name, malformed
  suppression, expired suppression, suppression without owner, rollback without
  incident id, stale commit SHA, and policy that tries to suppress invalid
  evidence.
- Timeouts: CI timeout in required phase is infrastructure failure, not
  advisory pass.
- Concurrent users or retries: repeated status updates for one commit are
  idempotent and do not create conflicting check conclusions.
- Broken dependencies: GitHub status API unavailable records publication failure
  while local report and audit witness remain complete.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Rollout policy evaluation adds less than 50 ms to assessment. | Policy benchmark. |
| Load | Suppression table supports at least 1,000 active entries with deterministic lookup. | Generated suppression fixture. |
| Security | Non-overridable invalid evidence and required binding failures cannot be waived. | Abuse-prevention fixtures. |
| Accessibility | Advisory, required, rollback, and non-overridable states use explicit text labels. | PR comment and report snapshots. |
