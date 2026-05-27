---
title: HLAW-015 BundleProvenanceReportSection
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-015 BundleProvenanceReportSection

## Feature Overview & Objectives

### Problem Statement

Every Holmes law assurance report must be traceable to the Wesley contract
bundle that produced its evidence. Reviewers need schemaHash, lawHash,
profileHash, bundleHash, law codec, compiler identity, and source artifact
references in one stable section. Without that section, semantic findings and
coverage gates are detached from the exact compiler inputs they judge.

### Target User/Audience

- Release maintainers verifying evidence provenance.
- Incident reviewers tracing a report back to generated artifacts.
- GitHub and CLI renderers displaying hash families safely.
- QA engineers testing partial manifests, copy/paste safety, and mismatch
  callouts.

### Success Metrics

| KPI | Target |
| --- | --- |
| Hash visibility | Accepted release reports show schema, law, profile, and bundle hashes in full-text data fields. |
| Provenance completeness | Compiler identity and law codec appear in 100% of provenance sections when manifest ingest accepts them. |
| Mismatch clarity | Traceability failures can link directly to provenance fields. |

## Scope Definition

### In Scope

- Define `BundleProvenanceReportSection` data rows for manifest provenance and
  cross-artifact hash consistency results.
- Include schemaHash, lawHash, profileHash, bundleHash, compiler name/version,
  law codec, manifest version, source references, generated artifact references,
  and traceability gate status.
- Define hash display data: full hash, short hash, algorithm, and copy-safe
  string.
- Define partial manifest behavior for local runs.
- Define mismatch callout fields linking to `BundleTraceabilityGateDecision`.

### Out of Scope

- No hash recomputation.
- No remote artifact download.
- No release signing or signature verification.
- No final Markdown formatting.
- No policy decision about whether a partial manifest blocks merge.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release maintainer, I want the report to show the exact contract bundle hash family so that I can audit what was assessed. |
| US-002 | As an incident reviewer, I want compiler and codec provenance so that I can reproduce or investigate old reports. |
| US-003 | As a renderer author, I want full and short hash fields so that output can be readable without losing copy/paste safety. |
| US-004 | As a QA engineer, I want mismatch callouts linked to traceability gates so that stale evidence is visible. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Manifest provenance includes all hash fields | Holmes builds the section | The section contains schemaHash, lawHash, profileHash, and bundleHash as full values. |
| US-002 | Manifest contains compiler `wesley` version and codec | Holmes builds the section | Compiler and codec fields are present and renderer-neutral. |
| US-003 | A renderer needs short display hashes | Holmes builds the section | Each hash has full and short display fields derived deterministically. |
| US-004 | Traceability gate failed on stale coverage | Holmes builds the section | The provenance section includes a mismatch callout referencing `lawCoverage`. |
| US-004 | Local manifest omits optional generated artifacts | Holmes builds the section | The section records those references as unavailable without failing construction. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Complete release provenance | Happy | complete manifest plus pass traceability gate | Full provenance section. |
| TS-002 | Partial local provenance | Happy | local manifest missing optional refs | Unavailable optional refs. |
| TS-003 | Stale coverage mismatch | Negative | failed traceability gate | Mismatch callout. |
| TS-004 | Long generated artifact list | Load | manifest with 5,000 artifacts | Truncated display with counts. |
| TS-005 | Malformed hash after validation bypass | Negative | constructed invalid provenance | Section constructor rejects input. |
| TS-006 | Copy-safe hash rendering | Accessibility | full hash fixture | Full text retained, short hash derived. |

### Happy Path Testing

1. Build section from normalized manifest provenance and traceability gate.
2. Assert full hash fields, short hash fields, compiler identity, codec, and
   manifest version are present.
3. Verify optional generated artifact references are represented deterministically.
4. Snapshot section JSON.

### Negative/Edge Case Testing

- Invalid inputs: missing required provenance field after validation bypass,
  invalid hash syntax, missing traceability gate reference, duplicate generated
  artifact ids, and short-hash collision within one section.
- Timeouts: section construction uses no IO or wall-clock time.
- Concurrent users or retries: short hash derivation and artifact ordering are
  deterministic under parallel construction.
- Broken dependencies: if manifest validation failed, this section may only
  render validation diagnostics, not trusted provenance.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Build provenance with 5,000 artifact refs in under 200 ms. | Synthetic manifest benchmark. |
| Load | Artifact reference truncation must keep total counts. | Large manifest fixture. |
| Security | Paths and URLs are untrusted data for later renderers. | Injection-like URL/path fixture. |
| Accessibility | Full hashes remain available as text, not tooltip-only or color-only data. | Contract test full hash fields. |
