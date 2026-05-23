# GH-115 feat(generator): Prisma schema+client emission

- Imported from: GitHub issue
- Issue: #115
- URL: https://github.com/flyingrobots/wesley/issues/115
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:20Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `group:future-generators`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Docs tracked in #130.

# [GEN-115] feat(generator): Prisma schema+client emission

## Overview

Add a Prisma compilation target so Wesley can emit `prisma.schema` and matching client glue from the canonical IR.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #130 (docs)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Prisma schema docs, Wesley IR

## User Story

As a **Prisma user**, I want **Wesley to emit Prisma schema/client artifacts**, so that **I can keep schema-first workflows while using Prisma**.

## Acceptance Criteria

- [ ] `wesley transform --target prisma` produces Prisma schema file and optional client scaffolding.
- [ ] Naming conventions align with GraphQL directives (tables, enums).
- [ ] CLI target selection updated; config manifest supports Prisma target.
- [ ] Snapshot tests cover representative schema shapes.
- [ ] Docs/tutorial updated via #130.

## Definition of Done

Prisma generator implemented, tests passing, CLI integration complete, docs ready.

## Scope

### In-Scope

- Generator for Prisma schema
- Optional client scaffolding
- CLI/config integration
- Tests/examples

### Out-of-Scope

- Prisma deployment automation (future)

### Deliverables

- **Est. Lines of Code:** 900-1100
- **Est. Blast Radius:** generator package, config, tests, examples

## Implementation Details

### High-Level Approach

Map IR to Prisma schema definitions, generate optional client helper package, integrate with CLI targets, add tests/examples.

### Affected Areas

- packages/wesley-generator-prisma (new)
- CLI/config integration
- Example projects/tests

### Implementation Steps

- [ ] Design mapping from IR to Prisma schema syntax.
- [ ] Implement generator producing schema/client glue.
- [ ] Integrate into CLI/manifest.
- [ ] Add tests and example usage.

## Test Plan

### Happy Path

- [ ] Generated schema passes `prisma validate` and client builds.

### Edge Cases

- [ ] Complex relationships, enums handled correctly.

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

- Output aligns with Prisma naming/relationships.

### Soft Requirements

- Provide configuration options for naming strategy.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Prisma practitioners for validation.

---

## Production Notes

### Priority: 3 / 5

Broadens ORM support.

### Complexity: 5 / 5

New generator + client scaffolding.

### Estimate: 120 - 160 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated schema mismatches expected DB shape.
- **Mitigations:** Validate with sample project, document limitations.
- **Rollback / Kill Switch:** Mark generator experimental until stable.
