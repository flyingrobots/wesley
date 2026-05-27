---
title: HLAW-028 McpExplainLawFindingTool
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-028 McpExplainLawFindingTool

## Feature Overview & Objectives

### Problem Statement

Agents need to explain one law finding without dumping the entire report. The
explanation must cite source artifact references, preserve Wesley's event kind,
name the policy posture, and suggest next actions without pretending to
autonomously fix semantic law.

### Target User/Audience

- Review agents answering "what does this finding mean?"
- PR reviewers inspecting a specific failed gate or semantic change.
- Holmes MCP developers defining explanation responses.
- QA engineers testing missing finding and citation fallback behavior.

### Success Metrics

| KPI | Target |
| --- | --- |
| Finding specificity | 100% of explanations include finding id, law id, subject, event kind, and source artifact reference. |
| Citation discipline | Explanations cite report or evidence resources when available. |
| Boundary clarity | Suggested next actions never say Holmes should edit or rebind `weslaw` automatically. |

## Scope Definition

### In Scope

- Define MCP tool `holmes.explainLawFinding`.
- Define request fields: assessment id, finding id, detail level, and optional
  include related gates flag.
- Define response fields: finding identity, plain-language explanation, source
  citations, related gates, policy posture, next actions, and unavailable data
  reasons.
- Define missing finding, stale assessment, and citation fallback behavior.
- Define deterministic explanation templates by event kind and gate type.

### Out of Scope

- No generative free-form diagnosis as authoritative output.
- No source file edits.
- No GitHub comment posting.
- No recomputation of semantic diffs.
- No cross-repo lookup.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As an agent, I want to explain a finding id so that a reviewer gets focused context. |
| US-002 | As a reviewer, I want source citations so that I can inspect the underlying evidence. |
| US-003 | As a Wesley maintainer, I want explanations to preserve event kind and avoid reclassification. |
| US-004 | As a QA engineer, I want missing finding behavior to be deterministic. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A valid finding id exists in assessment | The MCP tool runs | Response includes explanation, finding identity, and next actions. |
| US-002 | Source artifact resource is available | The tool explains finding | Response includes citation to artifact resource URI. |
| US-002 | Source artifact resource is unavailable | The tool explains finding | Response includes citation fallback reason. |
| US-003 | Finding event kind is `footprintExpanded` | The tool explains finding | Explanation uses that event kind and does not rename posture. |
| US-004 | Finding id is unknown | The tool runs | Response is not found with available finding count and no fabricated explanation. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Explain weakened scalar | Happy | finding fixture | Explanation with citations. |
| TS-002 | Explain footprint expansion | Happy | footprint finding | Preserved event kind. |
| TS-003 | Unknown finding id | Negative | nonexistent id | Not found. |
| TS-004 | Missing citation resource | Edge | source unavailable | Fallback reason. |
| TS-005 | Related failed gate | Happy | finding linked to gate | Related gate included. |
| TS-006 | Crafted finding text | Security | injection strings | Explanation treats strings as data. |

### Happy Path Testing

1. Register assessment with findings and resources.
2. Explain one finding by id.
3. Verify identity fields, event kind, citations, policy posture, and next
   actions.
4. Snapshot response for each supported high-level event template.

### Negative/Edge Case Testing

- Invalid inputs: missing assessment id, unknown finding id, stale assessment,
  unauthorized assessment, invalid detail level, missing citation resource, and
  finding without related gate.
- Timeouts: explanation uses stored report/resources and no network calls.
- Concurrent users or retries: explanation is deterministic for same assessment.
- Broken dependencies: resource lookup failure yields citation fallback, not
  fabricated source.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Explain one finding in under 50 ms after assessment lookup. | MCP tool benchmark. |
| Load | Large assessments use indexed finding lookup, not linear scan where avoidable. | 100,000 finding fixture. |
| Security | Explanation escapes untrusted finding strings in renderer-facing fields. | Injection fixture. |
| Accessibility | Explanation includes plain text summary and next-action fields. | Schema contract test. |
