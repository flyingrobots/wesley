# GH-176 feat(cli): integrate pg_prove test execution

- Imported from: GitHub issue
- Issue: #176
- URL: https://github.com/flyingrobots/wesley/issues/176
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:59Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `feature`, `pkg:wesley-cli`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Consider bundling pg_prove via docker or document prerequisites.

# [CLI-176] feat(cli): integrate pg_prove test execution

## Overview

Add a CLI entry point (e.g., `wesley test`) that executes generated pgTAP suites against a configured Postgres DSN, streaming results for local and CI usage.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #188 (E2E suite)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-cli/TASKLIST.md

## User Story

As a **developer**, I want **a CLI command to run generated pgTAP tests**, so that **I can verify emitted suites locally or in CI without manual setup**.

## Acceptance Criteria

- [ ] New command (e.g., `wesley test`) executes pgTAP suites via `pg_prove` or embedded runner.
- [ ] CLI handles DSN configuration via flags/env and surfaces helpful errors.
- [ ] Output stream supports human-readable text and JSON for CI parsing.
- [ ] Automated tests cover success, failure, timeout scenarios.
- [ ] Documentation updated with usage instructions.

## Definition of Done

Command merged, tests passing, docs updated, and CLI changelog entry added.

## Scope

### In-Scope

- CLI command implementation
- Runner integration
- Docs/tests

### Out-of-Scope

- Test suite authoring (covered elsewhere)

### Deliverables

- **Est. Lines of Code:** 400-600
- **Est. Blast Radius:** `packages/wesley-cli`, docs

## Implementation Details

### High-Level Approach

Wrapper around `pg_prove` or Node pgTAP runner, configure via manifest/flags, stream output, and integrate with CLI command framework.

### Affected Areas

- CLI command registry
- Config handling (DSN, options)
- Docs (CLI usage)

### Implementation Steps

- [ ] Determine execution strategy (shelling out vs Node wrapper).
- [ ] Implement command with argument parsing.
- [ ] Handle output streaming + JSON formatting.
- [ ] Add tests and update docs.

## Test Plan

### Happy Path

- [ ] Run command against example schema with pgTAP tests; expect success.

### Edge Cases

- [ ] Missing DSN -> helpful error.
- [ ] Timeout/failed tests -> exit with non-zero status and clear message.

### Failure Cases

- [ ] Validate JSON output format for CI.

### Monitoring & Success Metrics

- [ ] Potential telemetry of command usage (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local | CLI | TBD | pending | |
| CI | CLI | TBD | pending | |

## Requirements

### Hard Requirements

- Works cross-platform.
- Provides exit codes meaningful for CI.

### Soft Requirements

- Document pg_prove dependency or bundle.

### Runtime Requirements

- Access to Postgres DSN.

### Dependencies & Approvals

- [ ] Coordination with infra/testing for DSN management.

---

## Production Notes

### Priority: 4 / 5

Unlocks automated verification flows.

### Complexity: 4 / 5

CLI + external tooling integration.

### Estimate: 60 - 80 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Platform differences (pg_prove availability).
- **Mitigations:** Provide Docker fallback or bundle dependencies.
- **Rollback / Kill Switch:** Keep command behind experimental flag until stable.
