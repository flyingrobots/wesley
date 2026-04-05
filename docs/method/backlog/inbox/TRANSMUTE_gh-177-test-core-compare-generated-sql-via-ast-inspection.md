# GH-177 test(core): compare generated SQL via AST inspection

- Imported from: GitHub issue
- Issue: #177
- URL: https://github.com/flyingrobots/wesley/issues/177
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:19Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `tests`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Confirm licensing and compatibility of the SQL parser used (e.g., @supabase/pg-parser).

# [TEST-177] test(core): compare generated SQL via AST inspection

## Overview

Update core tests to compare generated SQL using AST inspection instead of raw string comparison, increasing resilience to formatting changes.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #178 (test audit)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: `@supabase/pg-parser`, existing SQL snapshots

## User Story

As a **maintainer**, I want **SQL generation tests to check structural equality**, so that **formatting tweaks don't cause brittle failures**.

## Acceptance Criteria

- [ ] SQL tests parse generated SQL into AST and compare structural equality.
- [ ] Existing fixtures updated to use new comparison helper.
- [ ] Snapshot tests remain available for human review where appropriate.
- [ ] Tests fail when semantics change even if formatting remains similar.

## Definition of Done

AST-based comparison implemented, tests updated, docs/changelog note added.

## Scope

### In-Scope

- Test helper creation
- Refactoring of relevant tests

### Out-of-Scope

- Changing SQL generation behavior

### Deliverables

- **Est. Lines of Code:** 200-300
- **Est. Blast Radius:** test suite, new helpers

## Implementation Details

### High-Level Approach

Introduce helper that parses SQL via pg-parser, normalizes AST, and compares; refactor tests to use helper; keep snapshots as optional context.

### Affected Areas

- packages/wesley-core/test helpers
- Existing SQL tests

### Implementation Steps

- [ ] Add AST comparison utility.
- [ ] Update tests to use helper.
- [ ] Ensure parser handles generated SQL (update config if needed).
- [ ] Document new testing approach.

## Test Plan

### Happy Path

- [ ] Tests pass with AST comparisons.

### Edge Cases

- [ ] Fallback for statements not supported by parser.

### Failure Cases

- [ ] Parser errors surface clearly.

### Monitoring & Success Metrics

- [ ] Reduced test flakiness.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| CI | Core tests | TBD | pending | |

## Requirements

### Hard Requirements

- Maintain current coverage.

### Soft Requirements

- Provide guidelines for writing new tests with helper.

### Runtime Requirements

- Ensure parser dependency optional for consumers (only dev/test).

### Dependencies & Approvals

- [ ] Core testing maintainers approval.

---

## Production Notes

### Priority: 3 / 5

Improves test resilience.

### Complexity: 3 / 5

Moderate rewrite effort.

### Estimate: 32 - 48 hours

Includes helper creation, test updates.

### Risk & Rollback

- **Primary Risks:** Parser incompatibilities with certain SQL.
- **Mitigations:** Provide fallback or document unsupported cases.
- **Rollback / Kill Switch:** Revert to string comparisons if necessary.
