---
title: HLAW-007 LawEvidenceValidationResult
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-007 LawEvidenceValidationResult

## Feature Overview & Objectives

### Problem Statement

Holmes must clearly separate invalid evidence from valid evidence that produces
failing assurance findings. A malformed law diff JSON file is not the same as a
coverage gate failure; unsupported bundle versions are not semantic law risks.
Without a typed validation result, CLI exit codes, GitHub comments, MCP
responses, and audit witnesses will conflate input errors with judgment.

`LawEvidenceValidationResult` defines the typed result envelope for all
first-stage evidence validation before Holmes runs gates or produces assurance
verdicts.

### Target User/Audience

- Holmes CLI users who need actionable diagnostics before assessment.
- CI maintainers mapping validation errors to hard job failures.
- MCP clients distinguishing bad requests from failing law gates.
- QA engineers verifying invalid artifact fixtures never produce findings.

### Success Metrics

| KPI | Target |
| --- | --- |
| Error separation | 100% of invalid evidence cases return validation errors and zero assurance findings. |
| Exit-code readiness | Every validation outcome maps to a documented future CLI exit category. |
| JSON stability | Validation result JSON snapshots remain deterministic across repeated runs. |

## Scope Definition

### In Scope

- Define a validation result object containing status, normalized bundle
  reference, validation errors, validation warnings, loaded artifact metadata,
  unsupported optional evidence, and future exit-code category.
- Define statuses: `valid`, `validWithWarnings`, `invalid`, and
  `infrastructureError`.
- Define diagnostic fields: code, severity, artifact role, path, message,
  details, source location if available, and remediation hint.
- Require invalid validation results to carry no assurance findings or gate
  decisions.
- Define JSON serialization for CLI, API, MCP, and audit witness reuse.

### Out of Scope

- No final Holmes verdict in this slice.
- No pass/warn/fail gate model in this slice except the placeholder
  exit-category hint.
- No GitHub rendering in this slice.
- No suppression behavior for validation errors.
- No automatic remediation or artifact regeneration.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CLI user, I want invalid evidence diagnostics before assessment so that I can fix file paths or formats first. |
| US-002 | As a CI maintainer, I want validation status separated from assurance status so that infrastructure and product risks do not share one exit reason. |
| US-003 | As an MCP client, I want machine-readable diagnostics with artifact roles so that agents can explain failures without parsing prose. |
| US-004 | As a QA engineer, I want validation snapshots to prove invalid inputs never emit findings or gates. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A bundle is missing its manifest artifact | Holmes validates evidence | The result status is `invalid` and includes `HLAW_BUNDLE_MISSING_REQUIRED_ARTIFACT`. |
| US-002 | An artifact read timeout occurs | Holmes validates evidence | The result status is `infrastructureError` and assessment does not run. |
| US-003 | A law diff artifact has malformed JSON | Holmes validates evidence | The diagnostic includes artifact role `lawDiff`, source path, code, and remediation hint. |
| US-004 | Evidence validation fails | Holmes prepares assessment input | No `SemanticChangeFinding`, coverage gate, or traceability gate is produced. |
| US-004 | Evidence validation succeeds with optional source schema absent | Holmes validates evidence | The result status is `validWithWarnings` only if policy asks missing optional source refs to warn; otherwise `valid`. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Valid bundle and artifacts | Happy | `fixtures/hlaw/bundles/clean-release.json` | Status `valid`. |
| TS-002 | Valid with optional evidence unavailable | Happy | `fixtures/hlaw/bundles/clean-local-minimal.json` | Status `valid` or `validWithWarnings` per policy. |
| TS-003 | Missing required artifact | Negative | missing manifest path | Status `invalid`, no findings. |
| TS-004 | Malformed law diff | Negative | malformed law diff fixture | Status `invalid`, role-specific diagnostic. |
| TS-005 | Filesystem timeout | Edge | fake locator timeout | Status `infrastructureError`. |
| TS-006 | Multiple invalid artifacts | Negative | bundle with malformed diff and invalid manifest | All diagnostics sorted deterministically. |
| TS-007 | Validation warnings only | Edge | optional source references absent | No gate decisions produced. |

### Happy Path Testing

1. Validate a clean evidence bundle.
2. Assert that status is `valid`, errors are empty, loaded artifact metadata is
   present, and normalized bundle identity is included.
3. Serialize validation result as JSON twice and assert byte equality.
4. Verify that no gate or finding fields appear in the validation result.

### Negative/Edge Case Testing

- Invalid inputs: missing required artifacts, unsupported versions, malformed
  JSON, invalid hashes, unknown event kinds, path traversal, count mismatches,
  and contradictory capability posture.
- Timeouts: fake locator returns read timeout; result is
  `infrastructureError` with no retry from validation result logic.
- Concurrent users or retries: validation result construction must be immutable
  after creation so concurrent renderers cannot mutate diagnostic order.
- Broken dependencies: unavailable filesystem, invalid UTF-8 where JSON bytes
  are expected, and adapter panic boundaries are mapped to infrastructure
  diagnostics where recoverable.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Construct validation results with 1,000 diagnostics in under 100 ms. | Synthetic diagnostic benchmark. |
| Load | JSON serialization must remain deterministic for large diagnostic arrays. | Snapshot large invalid bundle output. |
| Security | Diagnostics must not leak file contents or absolute paths unless configured for trusted local mode. | Fixtures with secret-like file names and content. |
| Accessibility | Text diagnostics must include code and remediation hint without relying on color. | Snapshot terminal text with color disabled. |
