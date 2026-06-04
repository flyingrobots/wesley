# GH-120 feat(generator): Drizzle schema emission

- Imported from: GitHub issue
- Issue: #120
- URL: https://github.com/flyingrobots/wesley/issues/120
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:21Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `group:future-generators`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Documentation tracked in #131.

# [GEN-120] feat(generator): Drizzle schema emission

## Overview

Add a Drizzle ORM compilation target so Wesley can output schema builders and typed helpers from the canonical IR.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #131 (docs)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Drizzle (pg-core) docs, Wesley IR

## User Story

As a **TypeScript developer**, I want **Drizzle schema emission**, so that **I can use Wesley-generated tables with Drizzle ORM**.

## Acceptance Criteria

- [ ] `wesley transform --target drizzle` outputs Drizzle schema definitions and helpers.
- [ ] Relations/helpers generated match TypeScript types.
- [ ] CLI target selection updated, examples/tests added.
- [ ] Snapshot tests cover representative schema shapes.
- [ ] Docs updated via #131.

## Definition of Done

Drizzle generator implemented, tests passing, CLI integration complete, docs ready.

## Scope

### In-Scope

- Generator module for Drizzle (pg-core)
- CLI integration
- Tests/examples

### Out-of-Scope

- Docs (handled in #131)

### Deliverables

- **Est. Lines of Code:** 800-1000
- **Est. Blast Radius:** generator package, config manifest, tests

## Implementation Details

### High-Level Approach

Map IR to Drizzle table builders, emit relation helpers, integrate with CLI target pipeline, add tests/examples.

### Affected Areas

- packages/wesley-generator-drizzle (new)
- CLI/config integration
- Tests/examples

### Implementation Steps

- [ ] Design mapping from IR to Drizzle tables/relations.
- [ ] Implement generator producing code.
- [ ] Integrate with CLI/manifest.
- [ ] Add tests and sample usage.

## Test Plan

### Happy Path

- [ ] Generated Drizzle schema compiles and can be imported in sample project.

### Edge Cases

- [ ] Complex relations, enums, defaults handled.

### Failure Cases

- [ ] Unsupported directives produce clear errors.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment    | Surface         | Owner | Status  | Notes |
| -------------- | --------------- | ----- | ------- | ----- |
| Unit tests     | Generator       | TBD   | pending |       |
| Sample project | Demo validation | TBD   | pending |       |

## Requirements

### Hard Requirements

- Output aligns with Drizzle conventions (pg-core).

### Soft Requirements

- Provide configuration options for schema namespace.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Drizzle community (optional) for validation.

---

## Production Notes

### Priority: 3 / 5

Expands ORM support.

### Complexity: 5 / 5

New generator + TypeScript integration.

### Estimate: 120 - 160 hours

Includes implementation, tests, examples.

### Risk & Rollback

- **Primary Risks:** Generated code mismatching Drizzle expectations.
- **Mitigations:** Validate with sample project, document limitations.
- **Rollback / Kill Switch:** Mark generator experimental until stable.
