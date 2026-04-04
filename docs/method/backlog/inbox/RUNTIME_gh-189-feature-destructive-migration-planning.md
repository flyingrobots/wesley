# GH-189 Feature: Destructive Migration Planning

- Imported from: GitHub issue
- Issue: #189
- URL: https://github.com/flyingrobots/wesley/issues/189
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:05Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: _none_

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Work closely with core planner maintainers to capture all destructive scenarios. Sub-issues 189.1–189.13 were collapsed into this ticket on 2025-10-23; use the phase checklists below instead of individual issues.

# [MIG-189] Feature: Destructive Migration Planning

## Overview

Extend the migration planner to detect destructive changes (drop table/column, shrinking types, etc.), surface risk explanations, and require explicit opt-in before generating or executing those steps.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #190 (CLI prompt), future docs tasks
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-core planner, migration strategy docs

## User Story

As a **database operator**, I want **Wesley to flag destructive schema changes**, so that **I can plan remediation steps and avoid accidental data loss**.

## Acceptance Criteria

- [ ] Planner detects destructive operations and classifies them (drop table/column, data rewrite, rename, etc.).
- [ ] Planner output includes risk metadata (data loss, lock severity) for each destructive step.
- [ ] CLI `plan` command highlights destructive steps and references mitigation guidance.
- [ ] Requires explicit confirmation flag (`--allow-destructive`) or interactive approval before plan execution/rehearsal.
- [ ] Tests cover detection logic and output formatting.

## Phase Checklist

### A. Detection & Classification (Diff Phase)
- [ ] DROP COLUMN detected with risk metadata (former #189.1/#189.5/#189.6)
- [ ] DROP TABLE detected with risk metadata (former #189.2/#189.7/#189.8)
- [ ] ALTER TYPE destructive paths detected (former #189.3/#189.9/#189.10)
- [ ] RENAME destructive footprints detected (former #189.4/#189.11/#189.12)

### B. Expand Phase SQL (Forward Application)
- [ ] Forward SQL emitted for DROP COLUMN/TABLE with guardrails
- [ ] ALTER TYPE expand SQL includes safe modifiers & warnings
- [ ] RENAME expand SQL emits reversible metadata hooks

### C. Backfill & Mitigation
- [ ] Backfill strategies generated for ALTER TYPE (configurable data transforms)
- [ ] Backfill strategies generated for DROP COLUMN/TABLE (archive/export guidance)
- [ ] Evidence warnings emitted when manual intervention required

### D. Contract & Rollback
- [ ] Rollback SQL/instructions generated for DROP COLUMN/TABLE/ALTER TYPE/RENAME (former #189.13)
- [ ] Configuration surface for `migration.rollbackStrategy`
- [ ] Docs outline rollback workflows and manual limitations

## Definition of Done

Destructive planner shipped, CLI integration functional, docs updated, and regression suite passing.

## Scope

### In-Scope

- Planner logic in `@wesley/core`
- CLI integration for warnings/flags (coordinate with #190)
- Documentation updates referencing new behavior

### Out-of-Scope

- Automatic mitigation strategies beyond configurable templates (future work)

### Deliverables

- **Est. Lines of Code:** 400-600
- **Est. Blast Radius:** `packages/wesley-core`, `packages/wesley-cli`, docs

## Implementation Details

### High-Level Approach

Expand schema diff to tag destructive operations, attach metadata (impact, lock level, recommended steps), and emit warnings to CLI. Provide configuration to block by default unless explicitly allowed.

### Affected Areas

- packages/wesley-core planner/diff modules
- packages/wesley-cli plan/rehearse commands
- docs/guides/migrations.md

### Implementation Steps

- [ ] Define destructive operation taxonomy and risk metadata structure.
- [ ] Update diff/planner to populate destructive metadata and satisfy Phase A.
- [ ] Update SQL generation/backfill/contract workflows for Phases B–D.
- [ ] Update CLI output to display warnings and require `--allow-destructive`.
- [ ] Write tests covering detection, SQL generation, and CLI messaging.
- [ ] Update docs with guidance and safe practices.

## Test Plan

### Happy Path

- [ ] Planning additive migrations unchanged.
- [ ] Destructive change triggers warning and requires opt-in.

### Edge Cases

- [ ] Multiple destructive changes aggregated correctly.
- [ ] CI environment fails if flag not provided.

### Failure Cases

- [ ] Ensure CLI aborts when user declines or flag missing.

### Monitoring & Success Metrics

- [ ] Optional telemetry counts of destructive warnings (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Planner | TBD | pending | |
| CLI e2e | plan/rehearse | TBD | pending | |

## Requirements

### Hard Requirements

- Destructive operations blocked by default.
- Provide clear user messaging including remediation guidance.

### Soft Requirements

- Configurable allowlist for specific destructive changes (future follow-up).

### Runtime Requirements

- Works in non-interactive CI mode with explicit flag.

### Dependencies & Approvals

- [ ] Sign-off from product/DBA stakeholders on messaging.
- [ ] CLI prompt feature (#190) for interactive UX.

---

## Production Notes

### Priority: 5 / 5

Critical safety feature.

### Complexity: 4 / 5

Planner + CLI coordination.

### Estimate: 60 - 80 hours

Includes planner changes, CLI integration, tests, docs.

### Risk & Rollback

- **Primary Risks:** False positives/negatives causing friction.
- **Mitigations:** Provide escape hatches and thorough tests.
- **Rollback / Kill Switch:** Feature flag to disable destructive detection temporarily.
