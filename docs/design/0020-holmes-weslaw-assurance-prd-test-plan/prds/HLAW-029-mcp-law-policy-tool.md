---
title: HLAW-029 McpLawPolicyTool
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-029 McpLawPolicyTool

## Feature Overview & Objectives

### Problem Statement

Agents need to inspect active law assurance policy without parsing local config
files or guessing which profile is active. The MCP policy tool must expose
thresholds, required gates, severity mappings, override rules, and
non-overridable checks in a safe, redacted, versioned response.

### Target User/Audience

- Agents explaining why a gate passed or failed.
- Release maintainers reviewing active policy profile.
- Holmes policy developers validating profile selection behavior.
- QA engineers testing redaction, unknown profiles, and stale policy detection.

### Success Metrics

| KPI | Target |
| --- | --- |
| Policy transparency | Tool response lists required gates, thresholds, and non-overridable checks for the selected profile. |
| Redaction safety | Secret or environment-derived policy values are never exposed. |
| Profile correctness | Unknown profiles fail with deterministic diagnostics. |

## Scope Definition

### In Scope

- Define MCP tool `holmes.getLawPolicy`.
- Define request fields: policy path or assessment id, profile id, include
  defaults flag, and redaction mode.
- Define response fields: policy version, profile, thresholds, severity
  mappings, required evidence, override eligibility, non-overridable checks,
  source reference, and stale policy flag.
- Define redaction rules for secrets, token-like values, and local absolute
  paths.
- Define unknown profile and unsupported policy version errors.

### Out of Scope

- No policy editing.
- No branch protection mutation.
- No remote policy discovery.
- No profile inference from environment variables.
- No private secret reveal for debugging.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As an agent, I want active policy thresholds so that I can explain why a law gate failed. |
| US-002 | As a release maintainer, I want non-overridable checks listed so that override boundaries are clear. |
| US-003 | As a security reviewer, I want sensitive policy fields redacted in MCP responses. |
| US-004 | As a QA engineer, I want unknown profiles and stale policy states tested. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Valid policy and profile are supplied | The tool runs | Response includes thresholds and severity mappings for that profile. |
| US-002 | Policy marks validation failures non-overridable | The tool runs | Response lists validation failure under non-overridable checks. |
| US-003 | Policy source contains token-like field | The tool runs | Response redacts the field and records redaction count. |
| US-004 | Profile id is unknown | The tool runs | Response is unknown-profile error with available profile ids. |
| US-004 | Assessment policy hash differs from current policy hash | The tool runs by assessment id | Response marks policy stale. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Read release policy | Happy | valid policy fixture | Thresholds and required gates returned. |
| TS-002 | Read local policy | Happy | local profile fixture | Advisory posture returned. |
| TS-003 | Unknown profile | Negative | missing profile id | Unknown-profile error. |
| TS-004 | Unsupported policy version | Negative | future policy fixture | Unsupported version error. |
| TS-005 | Secret field redaction | Security | token-like values | Redacted response. |
| TS-006 | Stale assessment policy | Edge | mismatched policy hash | Stale flag. |

### Happy Path Testing

1. Invoke tool with valid policy and release profile.
2. Assert thresholds, severity mappings, required evidence, and
   non-overridable checks are present.
3. Invoke with local profile and compare advisory differences.
4. Snapshot redacted response.

### Negative/Edge Case Testing

- Invalid inputs: missing policy reference, unsupported version, unknown
  profile, malformed policy, invalid threshold, duplicate profile id, stale
  assessment policy hash, and unauthorized path.
- Timeouts: policy file read timeout maps to MCP infrastructure error.
- Concurrent users or retries: policy response is deterministic for same policy
  bytes and redaction mode.
- Broken dependencies: no GitHub dependency; unavailable assessment id returns
  not found.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Return policy response in under 100 ms after bytes are loaded. | MCP policy benchmark. |
| Load | Policies with 1,000 mappings remain serializable and sorted. | Large policy fixture. |
| Security | Redaction covers token-like keys, secret-like values, and local absolute paths. | Redaction fixture suite. |
| Accessibility | Response includes text profile and rule descriptions. | Schema contract test. |
