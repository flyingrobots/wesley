---
title: HLAW-020 LawAssuranceExitCodePolicy
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-020 LawAssuranceExitCodePolicy

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance commands need exit codes that are predictable for humans
and CI. Validation errors, failed gates, warnings, unavailable advisory
evidence, publisher failures, and internal errors are different outcomes. If
they all return one generic failure code, CI cannot decide whether to fix
workflow wiring, add law coverage, or retry infrastructure.

### Target User/Audience

- CI maintainers configuring branch protection and release gates.
- CLI users interpreting command failures.
- QA engineers writing negative command tests.
- Future GitHub publishers mapping local command outcomes to checks.

### Success Metrics

| KPI | Target |
| --- | --- |
| Outcome specificity | Every command outcome maps to one documented exit category. |
| CI predictability | `--fail-on` changes only warning/gate handling, not validation error handling. |
| Test coverage | Each exit category has at least one command-level fixture. |

## Scope Definition

### In Scope

- Define exit categories for success, success-with-warnings, validation failure,
  assurance failure, unavailable required evidence, publisher failure,
  infrastructure error, usage error, and internal error.
- Define numeric exit code recommendations for POSIX CLI behavior.
- Define `--fail-on` semantics for warnings, failed gates, unavailable gates,
  and validation failures.
- Define command-specific application for `validate`, `assess`, and `report`.
- Define negative tests for every category.

### Out of Scope

- No GitHub check conclusion mapping in this slice.
- No MCP error-code mapping.
- No branch protection configuration.
- No suppression or override policy.
- No retry policy beyond preserving distinct infrastructure errors.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CI maintainer, I want failed release gates to exit differently from malformed evidence so that workflow failures are actionable. |
| US-002 | As a local developer, I want warning-only assessments to optionally succeed so that local exploration is not blocked. |
| US-003 | As a QA engineer, I want one fixture per exit category so that regressions are obvious. |
| US-004 | As a CLI user, I want usage errors to be distinct from internal errors so that I know when I supplied bad flags. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Evidence validation fails | Any law assurance command validates inputs | The exit category is validation failure regardless of `--fail-on`. |
| US-001 | Assessment has a failed release gate | `--fail-on fail` is active | The exit category is assurance failure. |
| US-002 | Assessment has warnings only | `--fail-on fail` is active | The command exits success-with-warnings. |
| US-002 | Assessment has warnings only | `--fail-on warn` is active | The command exits assurance failure or warning-failure according to documented code table. |
| US-004 | User supplies unknown format | The command parses flags | The exit category is usage error. |
| US-004 | An unexpected panic boundary is caught | The command exits | The exit category is internal error and no success artifact is written. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Clean validate | Happy | clean bundle | Success code. |
| TS-002 | Invalid evidence | Negative | malformed law diff | Validation failure code. |
| TS-003 | Failed gate | Negative | missing required coverage | Assurance failure code. |
| TS-004 | Warning-only local assessment | Happy | advisory warning | Success-with-warnings or warning failure per flag. |
| TS-005 | Unknown CLI flag | Negative | `--wat` | Usage error code. |
| TS-006 | Writer failure | Edge | unwritable output path | Infrastructure error code. |

### Happy Path Testing

1. Run `validate`, `assess`, and `report` happy-path fixtures.
2. Verify success or success-with-warnings codes.
3. Run assessment warning fixtures with each `--fail-on` mode.
4. Snapshot command stderr/stdout and exit categories.

### Negative/Edge Case Testing

- Invalid inputs: malformed evidence, unknown profile, failed gates, unavailable
  required evidence, unknown format, missing required CLI args, writer failure,
  publisher failure placeholder, and internal error injection.
- Timeouts: artifact locator timeout maps to infrastructure error, not internal
  error or assurance failure.
- Concurrent users or retries: exit code depends only on command result, not on
  concurrent run order.
- Broken dependencies: unavailable GitHub publisher in future commands maps to
  publisher failure, not evidence validation failure.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Exit policy evaluation is constant-time relative to report size after summary counts are known. | Unit benchmark over synthetic summaries. |
| Load | Large diagnostic lists do not affect selected exit category except by severity maximum. | Large validation result fixture. |
| Security | Usage errors must not echo secret environment values. | Fixture with secret-like env var and bad flags. |
| Accessibility | CLI text always names the exit category and primary reason. | Snapshot stderr/stdout with color disabled. |
