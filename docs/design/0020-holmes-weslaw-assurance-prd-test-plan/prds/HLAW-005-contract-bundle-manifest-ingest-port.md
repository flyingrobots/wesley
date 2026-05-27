---
title: HLAW-005 ContractBundleManifestIngestPort
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-005 ContractBundleManifestIngestPort

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance depends on traceability: law diffs, coverage reports, and
capability summaries are only meaningful if they were produced from the same
contract bundle family. Wesley emits manifests containing schema, law, profile,
bundle, compiler, and codec hashes. Holmes needs an ingest port that verifies
those fields are present and usable before any cross-artifact gate runs.

`ContractBundleManifestIngestPort` turns Wesley contract bundle manifests into a
normalized provenance record for later traceability gates and reports.

### Target User/Audience

- Release reviewers who need to see which schema and law hashes produced an
  assurance report.
- CI maintainers preventing stale law evidence from being mixed with current
  branch artifacts.
- Holmes report developers rendering provenance sections.
- QA engineers testing mismatch, partial manifest, and unsupported-version
  behavior.

### Success Metrics

| KPI | Target |
| --- | --- |
| Required hash validation | 100% of accepted release manifests include schemaHash, lawHash, profileHash, and bundleHash. |
| Producer traceability | 100% of accepted manifests include Wesley compiler identity and law codec version. |
| Mismatch readiness | Manifest ingest exposes normalized hash fields for later cross-artifact consistency checks. |

## Scope Definition

### In Scope

- Accept `wesley.contract-bundle-manifest/v1` JSON artifacts.
- Validate manifest version, schema hash, law hash, profile hash, bundle hash,
  law codec, compiler name/version, source paths, generated artifact references,
  and timestamp policy.
- Normalize required and optional provenance fields.
- Distinguish absent optional hashes from invalid required hashes.
- Preserve manifest source artifact reference for report links and audit
  witnesses.

### Out of Scope

- Holmes will not recompute schema, law, profile, or bundle hashes.
- Holmes will not decide whether the compiler version is supported beyond
  manifest schema compatibility in this slice.
- Holmes will not compare hashes across law artifacts until
  `BundleTraceabilityGateDecision`.
- Holmes will not download remote generated artifacts.
- Holmes will not render provenance tables in this slice.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release reviewer, I want Holmes to ingest bundle hashes so that every law assurance report can name the exact contract bundle. |
| US-002 | As a CI maintainer, I want malformed hashes rejected so that stale or handcrafted manifests cannot pass as Wesley output. |
| US-003 | As a Holmes report developer, I want compiler and codec provenance normalized so that reports can present generation context. |
| US-004 | As a QA engineer, I want optional provenance fields handled explicitly so that partial local manifests do not masquerade as release-ready evidence. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A manifest includes valid schema, law, profile, and bundle hashes | Holmes ingests it | The normalized provenance record exposes all four hashes exactly as authored. |
| US-002 | A manifest contains `schemaHash: "abc"` | Holmes ingests it | Validation fails with `HLAW_MANIFEST_INVALID_HASH`. |
| US-002 | A release manifest omits `bundleHash` | Holmes ingests it | Validation fails with `HLAW_MANIFEST_MISSING_REQUIRED_HASH`. |
| US-003 | A manifest includes compiler `wesley` version `0.1.0` and codec `weslaw-ir-json/v1` | Holmes ingests it | Compiler and codec fields are preserved for report rendering. |
| US-004 | A local manifest omits optional generated artifact references | Holmes ingests it | Validation succeeds and marks generated artifact references unavailable. |
| US-004 | A manifest timestamp differs between two otherwise identical runs | Holmes normalizes it | The timestamp is preserved as provenance but excluded from semantic equality checks. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Complete release manifest | Happy | `fixtures/hlaw/manifests/release-complete.json` | Accepted normalized provenance. |
| TS-002 | Minimal local manifest | Happy | `fixtures/hlaw/manifests/local-minimal.json` | Accepted with unavailable optional fields. |
| TS-003 | Invalid hash syntax | Negative | `fixtures/hlaw/manifests/invalid-hash.json` | `HLAW_MANIFEST_INVALID_HASH`. |
| TS-004 | Missing bundle hash | Negative | `fixtures/hlaw/manifests/missing-bundle-hash.json` | `HLAW_MANIFEST_MISSING_REQUIRED_HASH`. |
| TS-005 | Unsupported manifest version | Negative | `fixtures/hlaw/manifests/unsupported-version.json` | `HLAW_MANIFEST_UNSUPPORTED_VERSION`. |
| TS-006 | Future compiler version | Edge | `fixtures/hlaw/manifests/future-compiler.json` | Accepted unless manifest schema is unsupported; policy evaluates later. |
| TS-007 | Large generated artifact list | Load | generated fixture | Accepted within manifest ingest budget. |

### Happy Path Testing

1. Load a complete manifest through the artifact locator.
2. Validate version, hash formats, compiler identity, codec identity, profile
   id, and source references.
3. Assert that required hashes are preserved byte-for-byte.
4. Snapshot the normalized provenance record with deterministic field ordering.

### Negative/Edge Case Testing

- Invalid inputs: malformed JSON, unsupported manifest version, missing required
  hashes, invalid hash algorithm prefix, invalid digest length, duplicate
  generated artifact ids, invalid source path metadata, and non-string compiler
  fields.
- Timeouts: ingest does not fetch generated artifacts; remote or filesystem
  timeout behavior belongs to artifact location.
- Concurrent users or retries: repeated manifest ingest must normalize to the
  same provenance record even if timestamp fields differ in input fixtures.
- Broken dependencies: a manifest that references missing generated artifacts is
  accepted as provenance but later artifact availability checks may fail.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Ingest a manifest with 5,000 generated artifact references in under 250 ms after bytes are loaded. | Benchmark generated manifest fixtures. |
| Load | Generated artifact references must be streamed or normalized without quadratic duplicate checks. | Allocation and growth checks over generated references. |
| Security | Manifest source paths are metadata and must not trigger file reads. | Include path traversal strings and assert no access during manifest ingest. |
| Accessibility | Provenance fields must be available as full text, not truncated-only display strings. | Contract test normalized record includes complete hash values. |
