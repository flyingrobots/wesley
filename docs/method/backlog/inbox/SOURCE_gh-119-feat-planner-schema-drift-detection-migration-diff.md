# GH-119 feat(planner): schema drift detection + migration diff

- Imported from: GitHub issue
- Issue: #119
- URL: https://github.com/flyingrobots/wesley/issues/119
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:57Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `group:ddl-planning`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Feeds into destructive migration work (#189) and CLI prompts (#190).

# [PLANNER-119] feat(planner): schema drift detection + migration diff

## Overview

Add a schema diff engine comparing the canonical IR against prior snapshots to flag when migrations are required.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #189, #190
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing planner, TASKLIST notes

## User Story

As a **maintainer**, I want **automatic schema drift detection**, so that **Wesley warns me when migrations need to be regenerated**.

## Acceptance Criteria

- [ ] IR snapshots persisted per transform (hashed) under `.wesley/`.
- [ ] Diff runner detects additive/destructive changes and classifies impact (expand/backfill/switch/contract, breaking, unsafe).
- [ ] CLI (`wesley plan`, `wesley status`) surfaces drift reports and pending migrations.
- [ ] Planner integrates diff output to enqueue phase steps automatically.
- [ ] Tests cover additive, renaming, destructive scenarios.

## Definition of Done

Diff engine integrated, CLI reporting drift, tests passing, documentation updated.

## Scope

### In-Scope

- Snapshot persistence
- Diff algorithm
- CLI reporting
- Tests/docs

### Out-of-Scope

- Actual destructive migrations (covered in #189)

### Deliverables

- **Est. Lines of Code:** 700-900
- **Est. Blast Radius:** planner, CLI, evidence bundle, docs

## Implementation Details

### High-Level Approach

Persist normalized IR snapshots, compute diffs vs previous snapshot, classify changes, integrate with planner/CLI to highlight drift, update evidence bundles.

### Affected Areas

- packages/wesley-core (planner/diff)
- CLI commands (`plan`, `status`)
- Evidence bundle generation
- Docs

### Implementation Steps

- [ ] Implement snapshot storage/hashing.
- [ ] Build diff algorithm classifying changes.
- [ ] Integrate with planner to auto-enqueue migrations.
- [ ] Update CLI commands to report drift.
- [ ] Add tests and documentation.

## Test Plan

### Happy Path

- [ ] Modify schema; diff reports pending migrations, planner enqueues correct phases.

### Edge Cases

- [ ] Renames vs add/drop classification.
- [ ] Conflicting changes flagged as breaking.

### Failure Cases

- [ ] Snapshot missing -> CLI falls back gracefully.

### Monitoring & Success Metrics

- [ ] Optional telemetry for drift occurrences (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | Diff engine | TBD | pending | |

## Requirements

### Hard Requirements

- Accurate classification of drift; minimal false positives.

### Soft Requirements

- Provide guidance in docs for resolving drift.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Planner maintainers review design.

---

## Production Notes

### Priority: 5 / 5

Critical for safe migration workflow.

### Complexity: 5 / 5

Significant planner/diff work.

### Estimate: 120 - 160 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Misclassifying drift causing noisy warnings.
- **Mitigations:** Extensive tests, configurable severity.
- **Rollback / Kill Switch:** Feature flag to disable diff temporarily.
