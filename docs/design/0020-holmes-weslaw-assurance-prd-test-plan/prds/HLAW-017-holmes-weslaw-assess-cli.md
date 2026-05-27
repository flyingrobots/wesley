---
title: HLAW-017 holmes weslaw assess CLI
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-017 `holmes weslaw assess` CLI

## Feature Overview & Objectives

### Problem Statement

After evidence validates, operators need Holmes to evaluate law findings and
gates under a selected policy profile. The assessment command must produce a
structured report document and machine-readable verdict while preserving the
boundary that Wesley owns semantic law facts. It must not blur validation errors
with assurance failures.

### Target User/Audience

- CI maintainers running law assurance as a merge or release gate.
- Local developers checking whether law evidence would pass profile policy.
- Release reviewers consuming JSON or text summaries.
- Agents that need structured gates and findings.

### Success Metrics

| KPI | Target |
| --- | --- |
| Gate completeness | Assessment output includes semantic findings, coverage gates, traceability gates, and provenance when evidence is valid. |
| Profile clarity | Every assessment names the selected policy profile. |
| Fail-on control | `--fail-on` behavior is documented for validation errors, failed gates, warnings, and unavailable gates. |

## Scope Definition

### In Scope

- Define command: `holmes weslaw assess --bundle <path> --policy <path>`.
- Support `--profile <id>`, `--format text|json`, `--fail-on <level>`, and
  `--output <path>` as design requirements.
- Run validation first; assessment proceeds only on valid evidence.
- Produce `LawAssuranceReportDocument`, findings, gate decisions, and verdict
  summary.
- Define missing optional artifact behavior and policy selection behavior.

### Out of Scope

- No GitHub publishing.
- No final standalone rendering command behavior beyond immediate command
  output.
- No policy schema details beyond consuming a valid policy.
- No suppression and override implementation.
- No calling Wesley to generate missing artifacts.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CI maintainer, I want assessment to fail the job when release-required law gates fail. |
| US-002 | As a local developer, I want advisory output without hard failure when using a local profile. |
| US-003 | As an agent, I want JSON findings and gates so that I can summarize next actions. |
| US-004 | As a QA engineer, I want validation failures to stop assessment before any verdict is emitted. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Valid evidence with a failing release coverage gate | The user runs `holmes weslaw assess --profile ci-release --fail-on fail` | The command exits failure and emits a failed gate. |
| US-002 | Valid evidence with advisory warnings under local profile | The command runs with `--fail-on fail` | The command exits success and reports warnings. |
| US-003 | `--format json` is supplied | The command runs | Output contains report document, verdict, findings, gates, and validation summary. |
| US-004 | Evidence validation is invalid | The command runs | Assessment stops and emits only validation result with validation exit category. |
| US-004 | Policy profile is unknown | The command runs | The command fails with unknown-profile diagnostic before gate evaluation. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Passing release assessment | Happy | clean bundle plus strict policy | Success verdict. |
| TS-002 | Failing coverage gate | Negative | missing required coverage | Failed verdict and exit failure. |
| TS-003 | Advisory local warning | Happy | advisory coverage gap | Warning verdict, success with `--fail-on fail`. |
| TS-004 | Invalid evidence | Negative | malformed law diff | Validation result only. |
| TS-005 | Unknown profile | Negative | policy missing profile | Unknown profile diagnostic. |
| TS-006 | Unavailable optional capability evidence | Edge | local partial bundle | Unavailable section per policy. |

### Happy Path Testing

1. Run assessment over clean release fixtures.
2. Assert validation passes before gates run.
3. Assert report document includes law diff, coverage, capabilities, provenance,
   and traceability sections.
4. Assert exit behavior follows `--fail-on`.
5. Snapshot JSON output.

### Negative/Edge Case Testing

- Invalid inputs: missing bundle, invalid bundle, missing policy, unknown
  profile, unsupported policy version, invalid `--fail-on`, failed gates,
  unavailable required evidence, and warning-only outcomes.
- Timeouts: adapter timeouts during artifact load produce validation or
  infrastructure errors before assessment; assessment itself is CPU-only.
- Concurrent users or retries: repeated assessment with same fake clock and
  inputs produces identical report JSON.
- Broken dependencies: no GitHub dependency is allowed; file writer failures
  are surfaced only when `--output` is requested.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Assess a 10,000-finding bundle under 2 seconds after bytes are loaded. | CLI integration benchmark. |
| Load | JSON output must remain valid for large reports and avoid terminal-only truncation. | Large fixture snapshots. |
| Security | Policy and bundle paths follow locator confinement rules. | Path traversal policy tests. |
| Accessibility | Text output includes status words, counts, and diagnostics without color dependence. | Snapshot with color disabled. |
