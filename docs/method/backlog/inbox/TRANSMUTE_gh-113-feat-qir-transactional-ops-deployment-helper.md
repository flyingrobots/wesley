# GH-113 feat(qir): transactional ops deployment helper

- Imported from: GitHub issue
- Issue: #113
- URL: https://github.com/flyingrobots/wesley/issues/113
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:15Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:qir-phase-c`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Example usage should integrate with CI guidance in docs.

# [QIR-113] feat(qir): transactional ops deployment helper

## Overview

Provide a safe deployment helper for `--ops` output that wraps functions/views in a transaction with rollback on failure.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: QIR Phase C tasks
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Current docs instructing `psql` usage

## User Story

As a **DB operator**, I want **a transactional helper for ops artifacts**, so that **deployments don’t leave partially applied functions/views**.

## Acceptance Criteria

- [ ] New CLI subcommand/script (e.g. `wesley ops apply`) applies ops artifacts within a transaction or staged deployment.
- [ ] Supports dry-run mode and verbose logging.
- [ ] Compatible with functions and views, respecting schema overrides.
- [ ] Failure mid-run rolls back entire batch.
- [ ] Documentation updated to recommend helper and remove unsafe manual instructions.

## Definition of Done

Helper implemented, tests passing, docs updated, unsafe instructions replaced.

## Scope

### In-Scope

- CLI/script helper
- Logging/dry-run support
- Docs/tests

### Out-of-Scope

- Additional ops generation features

### Deliverables

- **Est. Lines of Code:** 300-400
- **Est. Blast Radius:** CLI ops tooling, docs

## Implementation Details

### High-Level Approach

Wrap ops SQL files into transaction execution (psql or Node driver), provide dry-run flag, integrate with CLI, update docs.

### Affected Areas

- packages/wesley-cli ops tooling
- Docs (ops deployment guide)

### Implementation Steps

- [ ] Implement transactional apply helper.
- [ ] Add dry-run/logging options.
- [ ] Write tests simulating success/failure.
- [ ] Update docs replacing manual instructions.

## Test Plan

### Happy Path

- [ ] Helper applies ops successfully and logs statements.

### Edge Cases

- [ ] Failure mid-run -> rollback verified.
- [ ] Schema overrides respected.

### Failure Cases

- [ ] Invalid SQL surfaces clear error without partial apply.

### Monitoring & Success Metrics

- [ ] Optional future telemetry.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | Ops helper | TBD | pending | |

## Requirements

### Hard Requirements

- Transactional safety with rollback.

### Soft Requirements

- Provide verbose logging for auditing.

### Runtime Requirements

- Works cross-platform (psql requirement documented).

### Dependencies & Approvals

- [ ] Planner/QIR maintainers review integration.

---

## Production Notes

### Priority: 4 / 5

Improves safety of ops deployment.

### Complexity: 3 / 5

Moderate CLI tooling.

### Estimate: 32 - 48 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Helper misconfigures environment.
- **Mitigations:** Provide dry-run, thorough logging.
- **Rollback / Kill Switch:** Document fallback to manual deployment.
