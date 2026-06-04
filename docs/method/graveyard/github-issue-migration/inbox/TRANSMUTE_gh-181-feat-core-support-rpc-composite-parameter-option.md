# GH-181 feat(core): support RPC composite parameter option

- Imported from: GitHub issue
- Issue: #181
- URL: https://github.com/flyingrobots/wesley/issues/181
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:03Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `feature`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Review existing parameter strategies (JSON, named args) to maintain compatibility.

# [CORE-181] feat(core): support RPC composite parameter option

## Overview

Add support for the optional composite-type strategy for RPC parameters so callers can supply table-derived composite types instead of JSON payloads.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #182, #185
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-core/TASKLIST.md (Option C notes)

## User Story

As a **developer invoking Wesley-generated RPCs**, I want **to opt into composite-type parameters**, so that **I can use strongly typed table structures instead of JSON**.

## Acceptance Criteria

- [ ] Config/flag exposed to select composite parameter strategy.
- [ ] Generator emits necessary `CREATE TYPE` statements when composite option enabled.
- [ ] Documentation updated to explain all parameter strategies.
- [ ] Tests cover composite option path alongside existing strategies.

## Definition of Done

Composite option implemented, tests passing, docs updated, and TASKLIST entry resolved.

## Scope

### In-Scope

- Config surface (CLI/config file)
- Generator updates for composite types
- Docs/tests

### Out-of-Scope

- Additional parameter strategies beyond composite

### Deliverables

- **Est. Lines of Code:** 250-350
- **Est. Blast Radius:** `packages/wesley-core`, generative SQL, docs

## Implementation Details

### High-Level Approach

Expose configuration option, update generator to derive composite types from table schema, ensure CLI/planner propagate option, and update documentation with usage instructions.

### Affected Areas

- generator configuration
- SQL emission (CREATE TYPE, function signatures)
- docs (RPC section)

### Implementation Steps

- [ ] Add config flag for composite parameters.
- [ ] Implement composite type generation and reference in functions.
- [ ] Update tests to cover new option.
- [ ] Document strategy comparison and usage.

## Test Plan

### Happy Path

- [ ] Schema with composite option generates `CREATE TYPE` + function using composite param.

### Edge Cases

- [ ] Ensure fallback to existing strategies when flag disabled.

### Failure Cases

- [ ] Flag conflicts or missing dependency raise clear errors.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment            | Surface       | Owner | Status  | Notes |
| ---------------------- | ------------- | ----- | ------- | ----- |
| Unit/Integration tests | RPC generator | TBD   | pending |       |

## Requirements

### Hard Requirements

- Composite option backwards compatible; default remains existing behavior.

### Soft Requirements

- Provide migration guidance for users switching options.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Coordination with generator/CLI maintainers.

---

## Production Notes

### Priority: 3 / 5

Completes configurable parameter strategies.

### Complexity: 3 / 5

Moderate generator + config work.

### Estimate: 40 - 60 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Inconsistent parameter behavior across strategies.
- **Mitigations:** Comprehensive tests, treat composite flag as experimental initially.
- **Rollback / Kill Switch:** Disable flag if issues arise.
