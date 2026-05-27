---
title: HLAW-044 TransitionalHolmesCliAliases
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-044 TransitionalHolmesCliAliases

## Feature Overview & Objectives

### Problem Statement

Existing workflows and operator habits may call legacy Holmes commands while
the Rust law assurance path is introduced. Transitional aliases can reduce
cutover friction, but they must not preserve Node as an authority or make old
command names look permanent. The aliases need explicit deprecation messages,
exit parity expectations, and removal gates.

### Target User/Audience

- Operators running existing Holmes CLI workflows.
- CI maintainers migrating workflow commands.
- Rust Holmes implementers designing command routing.
- QA engineers testing deprecation and parity behavior.

### Success Metrics

| KPI | Target |
| --- | --- |
| Cutover safety | Supported aliases route to the Rust law assurance path without invoking legacy Node authority. |
| Deprecation clarity | Every alias emits a planned removal version or removal condition. |
| Exit parity | Alias commands preserve documented exit categories for validation and assessment outcomes. |

## Scope Definition

### In Scope

- Define supported transitional aliases for law assurance validation,
  assessment, reporting, and PR comment preview.
- Define deprecation message content and stderr/stdout placement.
- Define exit category parity with canonical `holmes weslaw` commands.
- Define command help behavior and migration examples.
- Define removal gates: all workflows migrated, docs updated, CI proving no
  alias use, and release note published.

### Out of Scope

- No alias implementation.
- No support for arbitrary legacy flags.
- No Node command invocation.
- No long-term compatibility guarantee.
- No workflow YAML change in this slice.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As an operator, I want old command invocations to point me to the new Rust law assurance command. |
| US-002 | As a CI maintainer, I want aliases to preserve exit categories while workflows migrate. |
| US-003 | As a maintainer, I want deprecation text so old aliases do not become permanent. |
| US-004 | As a QA engineer, I want unsupported legacy flags rejected explicitly. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | User runs a supported alias for validation | CLI routes command | It invokes the canonical validation behavior and prints deprecation guidance. |
| US-002 | Alias assessment hits failed gate | CLI exits | Exit category matches canonical `holmes weslaw assess`. |
| US-003 | User runs alias help | CLI prints help | Help names canonical command and removal gate. |
| US-004 | User supplies unsupported legacy flag | CLI parses args | Command fails with unsupported-flag diagnostic and migration hint. |
| US-004 | Alias would require Node legacy behavior | CLI routes command | Command fails; no Node path is invoked. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Supported validate alias | Happy | alias command fixture | Canonical validate behavior plus deprecation text. |
| TS-002 | Supported assess alias | Happy | warning/fail fixtures | Exit parity. |
| TS-003 | Unsupported legacy flag | Negative | old flag fixture | Unsupported diagnostic. |
| TS-004 | Alias help | Happy | `--help` | Canonical command and removal gate shown. |
| TS-005 | Alias would call Node | Negative | retired command fixture | Fails without invoking Node. |
| TS-006 | Removal gate check | Edge | docs/workflow inventory | Alias retained or removable per criteria. |

### Happy Path Testing

1. Run supported aliases against clean validation and assessment fixtures.
2. Compare outputs and exit categories with canonical commands.
3. Assert deprecation text appears exactly once.
4. Verify help text includes canonical replacement.

### Negative/Edge Case Testing

- Invalid inputs: unsupported legacy flag, retired command, command requiring
  Node-only behavior, missing bundle, conflicting alias and canonical flags, and
  unknown subcommand.
- Timeouts: aliases use the same fake ports and timeout behavior as canonical
  commands.
- Concurrent users or retries: aliases must not write extra state beyond
  canonical command outputs.
- Broken dependencies: if canonical command fails, alias exits with canonical
  category and adds only deprecation context.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Alias dispatch adds under 5 ms before canonical command execution. | CLI dispatch benchmark. |
| Load | Help text remains concise and does not duplicate full legacy docs. | Help snapshot review. |
| Security | Alias routing must not shell out to Node or read legacy env vars. | Architecture guard and command fixture. |
| Accessibility | Deprecation text is plain text and includes replacement command. | Snapshot with color disabled. |
