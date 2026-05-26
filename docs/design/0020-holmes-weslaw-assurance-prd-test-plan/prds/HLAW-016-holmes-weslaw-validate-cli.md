---
title: HLAW-016 holmes weslaw validate CLI
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-016 `holmes weslaw validate` CLI

## Feature Overview & Objectives

### Problem Statement

Operators need a fast way to prove that law assurance evidence is readable,
version-compatible, and internally well-formed before Holmes makes any judgment.
The validation command must fail on bad evidence without reporting product risk
or merge readiness. This prevents malformed paths, stale artifact schemas, and
broken JSON from polluting later reports.

### Target User/Audience

- Local developers validating `weslaw` evidence before opening a PR.
- CI maintainers splitting evidence validation from assessment.
- QA engineers running negative fixture suites.
- Agents that need a narrow command for "is this evidence usable?"

### Success Metrics

| KPI | Target |
| --- | --- |
| Validation isolation | The command never emits assurance gates or verdicts. |
| Fixture coverage | Every validation error family has at least one documented fixture. |
| Output determinism | JSON output is byte-identical for identical inputs and fake-clock settings. |

## Scope Definition

### In Scope

- Define command: `holmes weslaw validate --bundle <path> [--profile <id>]`.
- Define optional artifact override flags for required evidence roles.
- Support output formats `text` and `json`.
- Emit `LawEvidenceValidationResult`.
- Define exit behavior for valid, valid-with-warnings, invalid evidence, and
  infrastructure errors.
- Define fixture golden outputs for clean, malformed, missing, unsupported, and
  path-policy cases.

### Out of Scope

- No assessment verdict, findings, gate decisions, or report rendering.
- No GitHub publishing.
- No MCP server behavior.
- No running Wesley commands to generate evidence.
- No auto-fix or regeneration of invalid evidence.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a local developer, I want to validate a law evidence bundle so that I can fix artifact problems before assessment. |
| US-002 | As a CI maintainer, I want a dedicated validation exit code so that bad inputs fail early. |
| US-003 | As an agent, I want JSON validation output so that I can explain exact evidence errors. |
| US-004 | As a QA engineer, I want golden text and JSON outputs so that command behavior remains stable. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A clean bundle path is supplied | The user runs `holmes weslaw validate --bundle bundle.json` | The command exits success and prints validation status. |
| US-002 | The law diff path is missing | The command runs | The command exits with validation-failure category and emits no findings. |
| US-003 | `--format json` is supplied | The command runs | Output is `LawEvidenceValidationResult` JSON. |
| US-004 | The same invalid fixture is run twice | The command runs | Text and JSON outputs are deterministic after path normalization. |
| US-004 | An unsupported bundle version is supplied | The command runs | Output includes `HLAW_BUNDLE_UNSUPPORTED_VERSION`. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Clean bundle validation | Happy | `fixtures/hlaw/bundles/clean-release.json` | Exit success, valid result. |
| TS-002 | JSON output | Happy | clean bundle with `--format json` | Deterministic JSON result. |
| TS-003 | Missing required artifact | Negative | missing law diff path | Validation failure exit. |
| TS-004 | Malformed bundle JSON | Negative | malformed bundle | Malformed diagnostic. |
| TS-005 | Path traversal | Security | traversal bundle | Path-policy diagnostic. |
| TS-006 | Filesystem timeout | Edge | fake locator timeout | Infrastructure error exit. |

### Happy Path Testing

1. Run `holmes weslaw validate --bundle clean-release.json --format json`.
2. Assert exit success, no assurance findings, and valid status.
3. Run text output and snapshot status, artifact roles, and warnings.
4. Confirm optional source evidence absence does not fail unless policy says so.

### Negative/Edge Case Testing

- Invalid inputs: missing `--bundle`, unreadable bundle, malformed JSON,
  unsupported version, missing required artifact, invalid path, and unknown
  output format.
- Timeouts: fake locator read timeout yields infrastructure error and no retry
  loop in the command.
- Concurrent users or retries: repeated command invocations must not write files
  or mutate workspace state.
- Broken dependencies: no GitHub or network dependency is allowed for validate.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Validate a clean bundle under 500 ms after process startup. | CLI integration benchmark. |
| Load | Handle large validation diagnostics without truncating JSON. | Invalid bundle with 1,000 diagnostics. |
| Security | Path policy blocks workspace escape before artifact parsing. | Traversal and symlink tests. |
| Accessibility | Text output includes diagnostic codes and remediation without relying on color. | Snapshot with color disabled. |
