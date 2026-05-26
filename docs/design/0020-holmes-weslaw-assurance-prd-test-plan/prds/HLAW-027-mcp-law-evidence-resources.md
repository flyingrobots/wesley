---
title: HLAW-027 McpLawEvidenceResources
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-027 McpLawEvidenceResources

## Feature Overview & Objectives

### Problem Statement

Agents often need to inspect raw law evidence, normalized validation results,
and rendered reports after an assessment. MCP resources provide a stable,
read-only way to expose these artifacts without inventing ad hoc file paths or
embedding large blobs in every tool response.

### Target User/Audience

- MCP agents retrieving evidence details on demand.
- Holmes MCP adapter developers defining resource URIs.
- Workspace admins enforcing access rules.
- QA engineers testing caching, invalid references, and schema examples.

### Success Metrics

| KPI | Target |
| --- | --- |
| Resource consistency | All law evidence resources use one documented URI scheme. |
| Access control | Unauthorized or stale resource ids fail with clear MCP errors. |
| Payload discipline | Large resources can be summarized or paged without corrupting canonical artifacts. |

## Scope Definition

### In Scope

- Define MCP resource URI family: `holmes://weslaw/<assessment-id>/<role>`.
- Define resources for law diff, law coverage, capability summary, bundle
  manifest, validation result, report document, rendered Markdown, and audit
  witness placeholder.
- Define cache keys based on assessment id, artifact role, and content hash.
- Define stale, missing, unauthorized, and invalid resource behavior.
- Define schema examples for small resources.

### Out of Scope

- No remote artifact storage.
- No resource mutation.
- No long-term retention guarantees.
- No dashboard or static site.
- No authentication design beyond workspace authorization requirements.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As an agent, I want to fetch the normalized report document resource so that I can answer detailed reviewer questions. |
| US-002 | As a workspace admin, I want resources scoped to an assessment id so that arbitrary files are not exposed. |
| US-003 | As a Holmes developer, I want resource ids tied to content hashes so that stale reads are detectable. |
| US-004 | As a QA engineer, I want resource schema examples for every supported role. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Assessment response includes report resource URI | Agent reads the resource | MCP returns the report document with declared media type. |
| US-002 | Agent requests a URI for unknown assessment id | Resource resolver runs | Resolver returns not found without reading arbitrary paths. |
| US-003 | Stored content hash differs from requested resource metadata | Resolver reads resource | Resolver returns stale resource diagnostic. |
| US-004 | Each supported role has a schema example | Docs validation runs | Examples validate against resource response schema. |
| US-004 | Resource payload exceeds configured inline size | Resolver returns resource | Response includes summary or paging metadata according to policy. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Read report resource | Happy | valid assessment id | Report payload returned. |
| TS-002 | Read law diff resource | Happy | valid law diff role | Law diff payload returned. |
| TS-003 | Unknown assessment id | Negative | nonexistent id | Not found. |
| TS-004 | Unauthorized resource | Security | different workspace id | Authorization error. |
| TS-005 | Stale content hash | Edge | changed artifact bytes | Stale diagnostic. |
| TS-006 | Large resource | Load | large report document | Size policy applied. |

### Happy Path Testing

1. Run a fake assessment that registers resource metadata.
2. Read each supported resource role by URI.
3. Verify media type, content hash, and payload or summary metadata.
4. Snapshot response schema examples.

### Negative/Edge Case Testing

- Invalid inputs: malformed URI, unknown assessment id, unknown role,
  unauthorized workspace, stale content hash, missing backing artifact,
  unsupported media type, and resource over max inline size.
- Timeouts: resource read timeout returns MCP resource error with role and id.
- Concurrent users or retries: repeated resource reads are idempotent and do not
  mutate cache state except allowed read-through metadata.
- Broken dependencies: missing local artifact after assessment returns stale or
  missing resource, not reassessment.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Resolve small resource in under 100 ms after authorization. | MCP resource harness benchmark. |
| Load | Large resources respect size limits and omit counts. | Large artifact fixture. |
| Security | URI parser prevents path traversal and arbitrary file reads. | Malformed URI and traversal tests. |
| Accessibility | Resource summaries include text role and status fields. | Schema contract test. |
