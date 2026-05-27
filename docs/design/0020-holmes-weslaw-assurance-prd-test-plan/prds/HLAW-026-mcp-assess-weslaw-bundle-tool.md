---
title: HLAW-026 McpAssessWeslawBundleTool
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-026 McpAssessWeslawBundleTool

## Feature Overview & Objectives

### Problem Statement

Agents need a structured way to ask Holmes to assess a `weslaw` evidence bundle
without shelling out through CLI text or scraping GitHub comments. The MCP tool
must expose the same validation and assessment semantics as the CLI while
respecting workspace authorization and artifact path policy.

### Target User/Audience

- MCP agents assisting reviewers with law assurance evidence.
- Holmes MCP adapter developers.
- Workspace administrators controlling which files tools may read.
- QA engineers testing request/response schemas and error mapping.

### Success Metrics

| KPI | Target |
| --- | --- |
| CLI parity | MCP assessment returns the same gates and findings as `holmes weslaw assess` for the same inputs. |
| Schema stability | Request and response schemas are versioned and fixture-tested. |
| Authorization clarity | Unauthorized bundle paths fail before artifact parsing. |

## Scope Definition

### In Scope

- Define MCP tool name `holmes.assessWeslawBundle`.
- Define request fields: bundle URI/path, policy URI/path, profile, output
  detail level, max findings, and include report document flag.
- Define response fields: validation result, verdict, gate summary, findings,
  report references, diagnostics, and omitted-detail accounting.
- Define workspace authorization and path confinement requirements.
- Define error mapping for invalid request, unauthorized path, validation
  failure, assessment failure, and infrastructure failure.

### Out of Scope

- No MCP server implementation.
- No remote URL fetching unless future workspace policy allows it.
- No GitHub publishing.
- No long-running job queue.
- No mutation of source files or evidence artifacts.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As an agent, I want to assess a law evidence bundle through MCP so that I can reason over structured gates and findings. |
| US-002 | As a workspace admin, I want MCP bundle access confined to authorized workspace paths. |
| US-003 | As a Holmes developer, I want MCP results to match CLI assessment semantics. |
| US-004 | As a QA engineer, I want deterministic examples for success and failure responses. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A valid request references a clean bundle and policy | The MCP tool runs | Response includes validation status, verdict, gates, and findings. |
| US-002 | Request path points outside authorized workspace | The MCP tool runs | Response is an authorization error before artifact parsing. |
| US-003 | CLI and MCP use the same clean fixture | Both assessments run | Gate ids, finding ids, and verdict match. |
| US-004 | Request asks for max 20 findings | The MCP tool runs on 100 findings | Response includes 20 findings and omitted count 80. |
| US-004 | Evidence validation fails | The MCP tool runs | Response includes validation result and no assessment verdict. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Clean MCP assessment | Happy | clean bundle and policy | Verdict and gates returned. |
| TS-002 | CLI parity | Happy | same fixture through CLI and MCP | Matching ids and verdict. |
| TS-003 | Unauthorized path | Security | outside workspace bundle path | Authorization error. |
| TS-004 | Invalid request schema | Negative | missing bundle field | Invalid request error. |
| TS-005 | Max findings truncation | Load | large report fixture | Omitted count reported. |
| TS-006 | Validation failure | Negative | malformed evidence | Validation result only. |

### Happy Path Testing

1. Submit a valid MCP request for a clean local bundle.
2. Compare response to CLI assessment fixture output.
3. Verify response schema version, verdict, gates, findings, and report
   references.
4. Snapshot compact and full-detail responses.

### Negative/Edge Case Testing

- Invalid inputs: missing bundle, unsupported request version, unknown profile,
  unauthorized path, path traversal, invalid max findings, missing policy, and
  malformed evidence.
- Timeouts: request-level timeout returns MCP timeout error with partial work
  discarded unless response streaming is designed later.
- Concurrent users or retries: concurrent requests over same read-only fixtures
  produce identical responses.
- Broken dependencies: filesystem adapter failure maps to infrastructure error;
  no GitHub dependency exists.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Respond to clean small bundle in under 1 second after request dispatch. | MCP harness benchmark. |
| Load | Large responses respect max findings and omitted-detail accounting. | 10,000-finding fixture. |
| Security | Workspace authorization happens before path canonicalization reads file contents. | Unauthorized path tests. |
| Accessibility | Response includes text status fields agents can quote directly. | Schema contract test. |
