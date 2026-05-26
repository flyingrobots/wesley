---
title: HLAW-046 LawAssuranceSchemaVersioning
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-046 LawAssuranceSchemaVersioning

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance will ingest several versioned artifact schemas: evidence
bundle, policy, report document, audit witness, agent summary, MCP responses,
and GitHub publication payloads. Without explicit compatibility rules, a future
Holmes implementation can accidentally accept evidence it does not understand,
reject compatible patch-level changes, or publish reports with mixed schema
generations. The versioning contract must be planned before implementation so
every adapter handles schema evolution consistently.

### Target User/Audience

- Holmes implementers defining Rust parsers and schema validators.
- Wesley maintainers publishing law evidence artifact schemas.
- CI maintainers upgrading workflows across multiple repos.
- Release managers interpreting unsupported-version failures.
- Agents and MCP clients consuming report and summary schemas.

### Success Metrics

| KPI | Target |
| --- | --- |
| Version coverage | Evidence bundle, policy, report, witness, MCP, agent summary, and GitHub payload schemas each have compatibility rules. |
| Unsupported-version clarity | 100% of unsupported major, malformed version, and missing version fixtures emit stable diagnostic codes. |
| Upgrade safety | Compatible additive changes are accepted only when their schema rules explicitly allow unknown fields or extensions. |

## Scope Definition

### In Scope

- Define semantic version fields for all Holmes law assurance artifact families.
- Define compatibility rules for major, minor, and patch changes in JSON schema
  artifacts and rendered report metadata.
- Define validator behavior for missing versions, malformed versions,
  unsupported major versions, unsupported minor versions, prerelease strings,
  and build metadata.
- Define migration notice behavior for supported-but-deprecated versions.
- Define schema registry layout for local validation fixtures.
- Define how version errors affect CLI exit codes, MCP error responses, GitHub
  comments, and audit witness output.

### Out of Scope

- No schema migration implementation is built in this slice.
- No automatic rewrite from old artifact versions to new artifact versions.
- No remote schema registry, package publishing, or hosted docs site.
- No changes to Wesley `weslaw` semantic Law IR versioning.
- No compatibility promise for draft or provisional fixture artifacts.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a Holmes implementer, I want every law assurance artifact to declare its schema version so that parsers can reject unknown formats deterministically. |
| US-002 | As a CI maintainer, I want compatible patch and minor changes to remain usable so that workflow upgrades do not break unnecessarily. |
| US-003 | As a release manager, I want unsupported-version diagnostics to name the artifact family and supported range so that the remediation path is obvious. |
| US-004 | As an MCP client author, I want schema version metadata on responses so that clients can detect and handle incompatible changes. |
| US-005 | As a QA engineer, I want fixtures for each compatibility boundary so that schema versioning cannot regress silently. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A law evidence bundle omits `schemaVersion` | Holmes validates the bundle | Validation fails with a missing-version diagnostic for the evidence bundle artifact. |
| US-001 | A report document declares `schemaVersion: "2.0.0"` while Holmes supports `1.x` | Holmes validates the report | Validation fails before report rendering and names the unsupported major version. |
| US-002 | A policy artifact declares a supported minor version with an additive optional field | Holmes validates the policy | Validation succeeds only if the policy schema marks the field as extension-safe. |
| US-003 | A witness artifact declares a malformed version string | CLI validation runs | Exit code is validation failure and the diagnostic includes artifact family, value, and accepted format. |
| US-004 | MCP assessment response is returned | Client inspects metadata | Response includes schema family, schema version, and stable URI or identifier for the response shape. |
| US-005 | Compatibility fixture matrix runs | Each boundary fixture is loaded | Accept/reject outcome matches the declared compatibility table. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Current evidence bundle version | Happy | `fixtures/versioning/evidence-bundle-v1.json` | Accepted. |
| TS-002 | Missing schema version | Negative | bundle without `schemaVersion` | Missing-version diagnostic. |
| TS-003 | Unsupported major version | Negative | `schemaVersion: "2.0.0"` | Unsupported-major diagnostic. |
| TS-004 | Unsupported minor version | Edge | `schemaVersion: "1.99.0"` | Unsupported-minor diagnostic unless configured range admits it. |
| TS-005 | Patch-compatible schema | Happy | `schemaVersion: "1.0.7"` | Accepted with normalized version metadata. |
| TS-006 | Malformed version string | Negative | `schemaVersion: "v1"` | Malformed-version diagnostic. |
| TS-007 | Deprecated but supported version | Edge | `schemaVersion: "1.0.0"` with deprecation table | Accepted with migration notice. |
| TS-008 | Mixed artifact generations | Negative | bundle v1, policy v2, witness v1 | Validation fails with mixed-family compatibility diagnostic. |

### Happy Path Testing

1. Load a complete evidence bundle where every artifact declares the current
   supported version.
2. Validate bundle, policy, report, witness, MCP summary, and GitHub payload
   schema versions against the registry.
3. Assert parsed domain objects carry normalized artifact family and version
   metadata.
4. Render report and audit witness with the same normalized versions.
5. Assert no migration notice is emitted for the current version set.

### Negative/Edge Case Testing

- Invalid inputs: missing version, null version, non-string version, malformed
  semver, unsupported major, unsupported minor, prerelease not allowed, mixed
  incompatible artifact families, and extension fields outside extension points.
- Timeouts: version validation is local and must not call network registries.
- Concurrent users or retries: registry reads are immutable and shared safely
  across concurrent validations.
- Broken dependencies: missing local schema registry is an infrastructure error,
  not a valid unsupported-version finding.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Version validation adds less than 25 ms for a complete artifact bundle. | Microbenchmark over fixture matrix. |
| Load | Registry lookup handles at least 100 schema families without changing diagnostic order. | Generated registry fixture. |
| Security | Unsupported versions fail closed and never skip structural validation. | Negative fixtures and audit witness assertion. |
| Accessibility | Version diagnostics include plain text family, supplied version, supported range, and remediation. | Snapshot CLI, MCP, and report diagnostics. |
