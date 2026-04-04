# GH-190 DX: Interactive CLI for Risky Operations

- Imported from: GitHub issue
- Issue: #190
- URL: https://github.com/flyingrobots/wesley/issues/190
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:06Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: _none_

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Coordinate with migration planner owners to reuse risk metadata.

# [DX-190] DX: Interactive CLI for Risky Operations

## Overview

Upgrade the CLI so that when destructive migration steps are detected it pauses, summarizes the risks (e.g., dropping tables), and requires explicit confirmation before proceeding.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #189 (destructive planner) for context
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: `packages/wesley-cli`, migration planner outputs

## User Story

As a **developer running migrations**, I want **clear prompts for destructive actions**, so that **I do not accidentally drop or alter data without acknowledging the risk**.

## Acceptance Criteria

- [ ] CLI detects destructive operations flagged by planner (drop table/column, irreversible changes).
- [ ] CLI displays a human-readable summary of destructive actions and their consequences.
- [ ] CLI prompts for explicit confirmation (yes/no) and aborts if declined.
- [ ] Non-interactive mode (CI) can bypass prompt with documented flag.
- [ ] Tests cover scenarios and documentation updated.

## Definition of Done

Feature merged, tests passing, docs updated, and destructive planner integration validated.

## Scope

### In-Scope

- Interactive prompt logic.
- Summary messaging for destructive steps.
- Configurable override for CI.

### Out-of-Scope

- New planner heuristics (covered in #189).

### Deliverables

- **Est. Lines of Code:** 200-300
- **Est. Blast Radius:** `packages/wesley-cli`, docs/CLI usage

## Implementation Details

### High-Level Approach

Enhance planner output to flag risks, add CLI middleware that inspects plan responses, display summary using colors/emojis, and require confirmation. Provide `--force` flag for automation.

### Affected Areas

- packages/wesley-cli (command execution flow)
- packages/wesley-core planner integration (risk data)
- docs/CLI guide

### Implementation Steps

- [ ] Extend planner output to indicate destructive steps (if not already present).
- [ ] Implement prompt using `enquirer`/`prompts` or native Node `readline`.
- [ ] Add `--force`/`--yes` flag for automation.
- [ ] Write unit/e2e tests for prompt logic.
- [ ] Update docs and changelog.

## Test Plan

### Happy Path

- [ ] CLI prompts on destructive plan and proceeds when user confirms.

### Edge Cases

- [ ] Non-interactive environment aborts unless `--force` used.
- [ ] Multiple destructive steps summarized correctly.

### Failure Cases

- [ ] User declines confirmation -> CLI exits gracefully.

### Monitoring & Success Metrics

- [ ] Optional telemetry on how often prompt triggered (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local CLI | plan/rehearse commands | TBD | pending | |

## Requirements

### Hard Requirements

- Works cross-platform (Windows/macOS/Linux).
- Does not break existing CI flows.

### Soft Requirements

- Provide informative, actionable messaging.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Destructive planner (#189) delivering risk metadata

---

## Production Notes

### Priority: 4 / 5

High-impact safety improvement.

### Complexity: 3 / 5

Moderate CLI work plus planner integration.

### Estimate: 24 - 32 hours

Includes implementation, testing, and docs.

### Risk & Rollback

- **Primary Risks:** Prompt interfering with automation.
- **Mitigations:** Provide `--force` flag and document usage.
- **Rollback / Kill Switch:** Feature flag to disable prompts if issues arise.
