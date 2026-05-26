---
title: HLAW-001 HolmesLawEvidenceBundle
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-001 HolmesLawEvidenceBundle

## Feature Overview & Objectives

### Problem Statement

Holmes needs one typed evidence input for Wesley `weslaw` assurance. Today the
future evidence surface is implied by several Wesley outputs: law diff JSON,
coverage JSON, report-only capability summaries, validation diagnostics, and
contract bundle manifests. Without a bundle contract, every Holmes interface
would invent its own flag set, required files, and failure semantics.

`HolmesLawEvidenceBundle` defines the first-class input envelope that groups
those artifacts without letting Holmes recalculate semantic law. Wesley remains
the compiler and law authority; Holmes validates that the provided evidence is
well-formed, mutually consistent, and sufficient for an assurance judgment.

### Target User/Audience

- Holmes CLI operators running local or CI law assurance checks.
- GitHub workflow maintainers wiring Wesley law artifacts into Holmes reports.
- MCP agents consuming a compact bundle reference instead of raw filesystem
  layout assumptions.
- Wesley maintainers reviewing whether Holmes is respecting compiler ownership
  boundaries.

### Success Metrics

| KPI | Target |
| --- | --- |
| Bundle completeness | 100% of required evidence paths are validated before any assurance gate runs. |
| Ownership clarity | 100% of bundle validation failures distinguish bad evidence from failed assurance judgment. |
| Interface reuse | CLI, API, GitHub, and MCP designs all reference the same bundle schema name and version. |

## Scope Definition

### In Scope

- Define a versioned `holmes.law-evidence-bundle/v1` JSON object accepted by
  Holmes law assurance features.
- Require explicit references for law diff, law coverage, capability summary,
  and contract bundle manifest artifacts.
- Allow optional references for Wesley validation diagnostics, law explain
  extracts, source schema, source `weslaw`, and rendered reports.
- Require a `profile` field naming the assurance profile being evaluated.
- Require `expectedBundleHash` when the caller wants cross-artifact traceability
  enforcement.
- Define unsupported-version, missing-path, unreadable-path, duplicate-path, and
  malformed-reference diagnostics.
- Define fixture families for clean bundles, partial optional bundles, missing
  required artifacts, unsupported versions, and stale manifests.

### Out of Scope

- Holmes will not parse GraphQL SDL or `weslaw` source to recreate semantic law.
- Holmes will not run `wesley law diff`, `wesley law coverage`,
  `wesley law capabilities`, or `wesley law validate`.
- Holmes will not decide whether a law diff event is semantically strengthening
  or weakening; it will consume Wesley's published event classification.
- Holmes will not publish GitHub comments in this slice.
- Holmes will not define final CLI flags in this slice beyond naming the bundle
  object consumed by later CLI features.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CI maintainer, I want to pass Holmes one bundle file so that workflow steps do not need to duplicate every law artifact path. |
| US-002 | As a Holmes domain developer, I want required and optional law artifacts separated so that validation can fail before assurance judgment begins. |
| US-003 | As a Wesley maintainer, I want the bundle to identify Wesley-produced artifact kinds so that Holmes cannot silently substitute its own semantic reconstruction. |
| US-004 | As an MCP agent, I want a compact bundle reference so that tool requests can assess law evidence without long path lists. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A JSON object with `version: "holmes.law-evidence-bundle/v1"` and all required artifact references | Holmes validates the bundle | The bundle is accepted and normalized into a deterministic internal input record. |
| US-001 | A workflow supplies the same artifact both as `lawDiff.path` and `lawCoverage.path` | Holmes validates the bundle | Validation fails with a duplicate artifact diagnostic unless the artifact kind explicitly supports multi-kind content. |
| US-002 | A bundle omits `lawDiff`, `lawCoverage`, `lawCapabilities`, or `contractBundleManifest` | Holmes validates the bundle | Validation fails with `HLAW_BUNDLE_MISSING_REQUIRED_ARTIFACT` before any gate is evaluated. |
| US-002 | A bundle omits optional `sourceSchema` or `sourceWeslaw` references | Holmes validates the bundle | Validation succeeds and records those optional references as unavailable. |
| US-003 | A bundle artifact declares an unsupported producer such as `custom-law-diff/v1` | Holmes validates the bundle | Validation fails with `HLAW_BUNDLE_UNSUPPORTED_ARTIFACT_KIND`. |
| US-003 | A bundle contains Wesley artifact references but no `profile` | Holmes validates the bundle | Validation fails with `HLAW_BUNDLE_MISSING_PROFILE`. |
| US-004 | An MCP caller sends a bundle URI plus profile | Holmes resolves the bundle | The same normalized bundle contract is used as the CLI path, with no MCP-only evidence shape. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Clean release bundle with required artifacts and expected bundle hash | Happy | `fixtures/hlaw/bundles/clean-release.json` | Accepted normalized bundle. |
| TS-002 | Clean local bundle with optional source references absent | Happy | `fixtures/hlaw/bundles/clean-local-minimal.json` | Accepted with optional references marked unavailable. |
| TS-003 | Missing law diff artifact | Negative | `fixtures/hlaw/bundles/missing-law-diff.json` | `HLAW_BUNDLE_MISSING_REQUIRED_ARTIFACT`. |
| TS-004 | Unsupported bundle version | Negative | `fixtures/hlaw/bundles/unsupported-version.json` | `HLAW_BUNDLE_UNSUPPORTED_VERSION`. |
| TS-005 | Required artifact path points outside workspace through traversal | Security | `fixtures/hlaw/bundles/path-traversal.json` | Rejected before file read. |
| TS-006 | Duplicate artifact path used for distinct required artifact kinds | Edge | `fixtures/hlaw/bundles/duplicate-required-path.json` | Rejected as ambiguous evidence. |
| TS-007 | Very large bundle with many optional rendered report references | Load | generated fixture with 1,000 optional refs | Validation stays deterministic and does not run assurance gates. |

### Happy Path Testing

1. Write a clean `holmes.law-evidence-bundle/v1` fixture with `profile`,
   `lawDiff`, `lawCoverage`, `lawCapabilities`, and `contractBundleManifest`.
2. Validate that Holmes reads the bundle and materializes a normalized input
   record with sorted artifact references.
3. Verify that optional source and rendered report references are preserved
   when present.
4. Verify that the validation result contains no assurance findings, because
   this slice only proves input acceptability.

### Negative/Edge Case Testing

- Invalid inputs: malformed JSON, unknown top-level keys under strict mode,
  missing required artifact references, unsupported artifact kinds, unsupported
  bundle versions, empty strings, non-string paths, duplicate artifact ids, and
  relative paths that escape the workspace.
- Timeouts: bundle validation must not perform network IO; any filesystem read
  timeout injected by an adapter is reported as input validation failure, not as
  an assurance gate failure.
- Concurrent users or retries: repeated validation of the same bundle must
  produce byte-identical normalized JSON and diagnostics.
- Broken dependencies: unreadable files, missing files, and invalid symlinks are
  reported per artifact with the artifact role included in the diagnostic.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Validate a 1,000-reference bundle in under 250 ms on a local development machine. | Benchmark synthetic bundle parsing and normalization without reading artifact bodies. |
| Load | Validation must remain O(n log n) or better over artifact references because references are sorted for deterministic output. | Generate bundles with 10, 100, and 1,000 optional references and compare growth. |
| Security | Paths must be workspace-confined after symlink normalization unless an explicit trusted absolute-path mode is later designed. | Fixtures for `../`, absolute paths, symlink escape, and encoded traversal. |
| Accessibility | Human text diagnostics must name the artifact role and path without relying on color. | Snapshot terminal and Markdown diagnostics with color disabled. |
