# GH-166 enhancement(host-node): gate missing tasks warnings

- Imported from: GitHub issue
- Issue: #166
- URL: https://github.com/flyingrobots/wesley/issues/166
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:13Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`, `pkg:wesley-host-node`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Tie into config management so operators can choose default verbosity.

# [HOST-166] enhancement(host-node): gate missing tasks warnings

## Overview

Make the runtime warning about missing `@wesley/tasks` optional or verbose-only so default runs stay quiet while power users can still enable diagnostics.

`@wesley/slaps` moved to `wesley-postgres` as `@wesley/postgres-slaps`; generic host-node no longer attempts to load it.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: TASKLIST item in `packages/wesley-host-node`
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-host-node/runtime config

## User Story

As a **developer running Wesley**, I want **to suppress optional tasks warnings unless I opt in**, so that **standard runs don’t surface noise when the package is not installed**.

## Acceptance Criteria

- [ ] Introduce config/flag to control missing tasks warnings (default: silent).
- [ ] Warnings emitted only when explicit verbose/debug mode enabled.
- [ ] Documentation updated to explain how to enable diagnostics.
- [ ] Tests cover both silent and verbose modes.

## Definition of Done

Configurable warning behaviour merged, tests passing, docs updated, and TASKLIST item checked off.

## Scope

### In-Scope

- Host-node runtime warning logic
- Configuration docs/tests

### Out-of-Scope

- New features for external executor integration

### Deliverables

- **Est. Lines of Code:** 100-150
- **Est. Blast Radius:** `packages/wesley-host-node`, docs

## Implementation Details

### High-Level Approach

Add configuration (env/CLI flag) to gate warnings, adjust runtime to respect setting, and update logging accordingly.

### Affected Areas

- Host-node runtime startup
- Config parsing and logging
- Docs (configuration section)

### Implementation Steps

- [ ] Introduce config flag (e.g., `--warn-missing-tasks`).
- [ ] Update runtime to suppress warnings by default.
- [ ] Add tests verifying behaviour in both modes.
- [ ] Document configuration/options.

## Test Plan

### Happy Path

- [ ] Default run produces no warnings.
- [ ] Enabling verbose flag emits warnings when tasks are missing.

### Edge Cases

- [ ] Ensure warnings still appear when packages partially configured.

### Failure Cases

- [ ] Invalid config surfaces helpful error.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface           | Owner | Status  | Notes |
| ----------- | ----------------- | ----- | ------- | ----- |
| Unit tests  | Host-node runtime | TBD   | pending |       |

## Requirements

### Hard Requirements

- Backward compatible; users relying on warnings can re-enable them easily.

### Soft Requirements

- Provide logging hint pointing to docs when verbose mode enabled.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Host-node maintainers review change.

---

## Production Notes

### Priority: 3 / 5

Quality-of-life improvement.

### Complexity: 2 / 5

Small config/logging change.

### Estimate: 16 - 24 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Missing warnings when users expect them.
- **Mitigations:** Provide clear documentation and default debug mode.
- **Rollback / Kill Switch:** Revert config change if complaints arise.
