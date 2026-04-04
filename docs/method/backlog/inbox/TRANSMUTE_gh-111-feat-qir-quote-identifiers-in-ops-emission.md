# GH-111 feat(qir): quote identifiers in --ops emission

- Imported from: GitHub issue
- Issue: #111
- URL: https://github.com/flyingrobots/wesley/issues/111
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:14Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:qir-phase-c`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Ensure interaction with identifier sanitisation/collision detection documented in design note.

# [QIR-111] feat(qir): quote identifiers in --ops emission

## Overview

Add safe identifier quoting to `wesley --ops` output to eliminate SQL injection risk and support reserved keywords/unicode identifiers.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: QIR Phase C tasks
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Current QIR emission modules, guide

## User Story

As a **developer using ops generation**, I want **identifiers safely quoted**, so that **reserved keywords/unicode names work without SQL injection risk**.

## Acceptance Criteria

- [ ] QIR emission (`emitView`/`emitFunction`) uses safe identifier quoting everywhere.
- [ ] Sanitisation respects PostgreSQL’s 63-byte limit; collision detection updated.
- [ ] Unit tests cover reserved keywords, Unicode, length edge cases.
- [ ] CLI docs updated; qir-ops guide removes warning about reserved words.

## Definition of Done

Quoted identifiers shipped, tests passing, docs updated, snapshots adjusted where necessary.

## Scope

### In-Scope

- QIR emission updates
- Collision detection adjustments
- Tests/docs updates

### Out-of-Scope

- Ops discovery or directive changes

### Deliverables

- **Est. Lines of Code:** 250-350
- **Est. Blast Radius:** QIR emission modules, tests, docs

## Implementation Details

### High-Level Approach

Wrap identifiers with proper quoting functions, adjust sanitisation/collision detection, update tests and docs.

### Affected Areas

- packages/wesley-core/domain/qir emission
- Tests
- Docs

### Implementation Steps

- [ ] Implement quoting helper and integrate into emission.
- [ ] Update collision detection logic.
- [ ] Add tests for edge cases.
- [ ] Update documentation.

## Test Plan

### Happy Path

- [ ] Generated SQL with quoted identifiers executes successfully.

### Edge Cases

- [ ] Reserved keywords/unicode identifiers.
- [ ] Names near 63-byte limit.

### Failure Cases

- [ ] Collision detection prevents duplicates.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | QIR emission | TBD | pending | |

## Requirements

### Hard Requirements

- Maintain deterministic naming.

### Soft Requirements

- Provide guidance on naming conventions.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] QIR maintainers review changes.

---

## Production Notes

### Priority: 4 / 5

Improves safety/usability.

### Complexity: 3 / 5

Moderate emission refactor.

### Estimate: 32 - 48 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Unexpected naming collisions.
- **Mitigations:** Extensive tests; fallback to previous behaviour if needed.
- **Rollback / Kill Switch:** Revert quoting helper if regressions severe.
