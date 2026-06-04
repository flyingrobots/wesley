# GH-138 feat(config): enforce mutually exclusive generators

- Imported from: GitHub issue
- Issue: #138
- URL: https://github.com/flyingrobots/wesley/issues/138
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:47Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:manifest-logic`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with docs issue #139 to reflect validation rules.

# [CONFIG-138] feat(config): enforce mutually exclusive generators

## Overview

Update `wesley.config` validation to enforce mutually exclusive generator choices (e.g., Prisma vs Drizzle) and provide clear error messages for incompatible targets.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #139 (docs update)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: current config schema, manifest logic

## User Story

As a **user configuring Wesley**, I want **the config to prevent incompatible generator combinations**, so that **I avoid confusing outputs or failures later**.

## Acceptance Criteria

- [ ] Config validation fails with clear error when mutually exclusive targets selected.
- [ ] `wesley init` prevents conflicting options in interactive selection.
- [ ] Validation logic tested and documented.

## Definition of Done

Validation implemented, tests passing, CLI integrated, docs referencing behaviour (#139).

## Scope

### In-Scope

- Config schema validation
- CLI init prompts
- Tests/docs

### Out-of-Scope

- Adding new generator targets (follow-up work)

### Deliverables

- **Est. Lines of Code:** 200-300
- **Est. Blast Radius:** config schema, CLI init, tests, docs

## Implementation Details

### High-Level Approach

Define generator families/conflicts, update schema validation to enforce exclusivity, update CLI init to respect rules, and add tests.

### Affected Areas

- Config schema (packages/wesley-config)
- CLI init command
- Documentation

### Implementation Steps

- [ ] Define conflict sets and update schema.
- [ ] Update CLI init prompts to disable conflicting choices.
- [ ] Add unit tests for validation.
- [ ] Update docs.

## Test Plan

### Happy Path

- [ ] Config with valid combinations loads successfully.

### Edge Cases

- [ ] Config with conflicting generators triggers error with actionable message.

### Failure Cases

- [ ] CLI init prevents conflicting selection.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface           | Owner | Status  | Notes |
| ----------- | ----------------- | ----- | ------- | ----- |
| Unit tests  | Config validation | TBD   | pending |       |

## Requirements

### Hard Requirements

- Maintain backward compatibility for existing valid configs.

### Soft Requirements

- Provide suggestions in error message (e.g., pick one of X).

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Config maintainers sign-off.

---

## Production Notes

### Priority: 4 / 5

Prevents misconfiguration.

### Complexity: 3 / 5

Validation + CLI updates.

### Estimate: 32 - 48 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** False positives blocking valid stacks.
- **Mitigations:** Provide override flag or quick fix instructions.
- **Rollback / Kill Switch:** Temporarily disable validation if issues arise.
