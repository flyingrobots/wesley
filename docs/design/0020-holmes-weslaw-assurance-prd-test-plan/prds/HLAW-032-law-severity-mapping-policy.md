---
title: HLAW-032 LawSeverityMappingPolicy
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-032 LawSeverityMappingPolicy

## Feature Overview & Objectives

### Problem Statement

Wesley classifies semantic law changes, but Holmes must map those event kinds
and coverage gaps into reviewer-facing severities under a policy profile.
Severity mapping is policy, not semantic truth. It must be explicit, testable,
profile-specific, and unable to mutate Wesley's original event classification.

### Target User/Audience

- Release managers deciding which law changes block release.
- Local developers using warning-oriented profiles.
- Holmes assessment developers applying severity policy.
- QA engineers testing unmapped events and profile differences.

### Success Metrics

| KPI | Target |
| --- | --- |
| Classification preservation | 100% of findings retain original Wesley event kind after severity mapping. |
| Mapping completeness | Release profiles define explicit behavior for every supported high-risk event kind. |
| Unmapped safety | Unmapped event kinds produce deterministic diagnostics or default posture. |

## Scope Definition

### In Scope

- Define severity mapping policy for law diff event kinds, coverage gate states,
  traceability gates, validation warnings, and unavailable evidence.
- Define severity values: info, advisory, warning, error, critical.
- Define profile-specific mappings and fallback behavior.
- Define diagnostics for unmapped event kinds when policy requires exhaustive
  mappings.
- Define tests proving severity mapping does not change event kind, posture, law
  id, subject, or gate state.

### Out of Scope

- No semantic law diff classification.
- No user interface for editing mappings.
- No branch protection setup.
- No suppression or override behavior.
- No expression language for dynamic severity.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release manager, I want law weakening events mapped to error or critical so that risky changes block release. |
| US-002 | As a local developer, I want the same event kinds mapped less strictly in local profiles. |
| US-003 | As a Wesley maintainer, I want original event kinds preserved so Holmes policy cannot rewrite compiler truth. |
| US-004 | As a QA engineer, I want unmapped event behavior covered by fixtures. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Release policy maps `lawRemoved` to critical | Holmes maps severity | Finding severity becomes critical and event kind remains `lawRemoved`. |
| US-002 | Local policy maps `coverageGap` to warning | Holmes maps severity | Gate finding is warning under local profile. |
| US-003 | A finding has event kind `footprintExpanded` | Severity mapping runs | The output still records original event kind `footprintExpanded`. |
| US-004 | Policy is exhaustive and event kind is unmapped | Mapping runs | Assessment fails with `HLAW_SEVERITY_UNMAPPED_EVENT_KIND`. |
| US-004 | Policy has default mapping | Unknown advisory event is mapped | Default severity applies and diagnostic records fallback use. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Release weakening event | Happy | weakening finding plus release policy | Error or critical severity. |
| TS-002 | Local advisory event | Happy | same finding plus local policy | Warning or advisory severity. |
| TS-003 | Unmapped exhaustive policy | Negative | unknown event | Unmapped diagnostic. |
| TS-004 | Default fallback policy | Edge | unknown advisory event | Default severity plus fallback record. |
| TS-005 | Invalid severity string | Negative | policy typo | Policy validation diagnostic. |
| TS-006 | Large mapping table | Load | 1,000 mappings | Fast deterministic lookup. |

### Happy Path Testing

1. Apply release and local severity policies to the same finding set.
2. Assert severities differ where profile says so.
3. Assert event kind, law id, subject, and posture are unchanged.
4. Snapshot mapped finding outputs.

### Negative/Edge Case Testing

- Invalid inputs: unknown severity, unmapped event under exhaustive policy,
  duplicate mapping, impossible gate state, missing default, and profile not
  found.
- Timeouts: mapping is CPU-only and deterministic.
- Concurrent users or retries: severity mapping uses immutable normalized policy.
- Broken dependencies: invalid policy prevents assessment before mapping.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Map 100,000 findings in under 250 ms. | Synthetic finding benchmark. |
| Load | Mapping lookup must be O(1) or O(log n). | Large mapping benchmark. |
| Security | Policy strings are data and never executed. | Injection-like mapping keys. |
| Accessibility | Mapped severity includes text label and original event kind. | Contract test mapped fields. |
