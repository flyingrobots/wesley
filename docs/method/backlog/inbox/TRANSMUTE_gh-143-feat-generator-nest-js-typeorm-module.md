# GH-143 feat(generator): Nest.js TypeORM module

- Imported from: GitHub issue
- Issue: #143
- URL: https://github.com/flyingrobots/wesley/issues/143
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:27Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:future-generators`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with demo issue #151 for validation.

# [GEN-143] feat(generator): Nest.js TypeORM module

## Overview

Emit Nest.js modules/services wired to Wesley-generated schema so TypeORM teams can integrate without manual boilerplate.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #151 (Nest demo)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: TypeORM + Nest docs, Wesley IR

## User Story

As a **Nest.js developer**, I want **generated modules/services for TypeORM**, so that **I can adopt Wesley with minimal boilerplate**.

## Acceptance Criteria

- [ ] Generator outputs TypeORM entities and Nest modules/services wrapping Wesley RPCs.
- [ ] Config manifest exposes TypeORM output (with mutual exclusion handled).
- [ ] Example Nest project compiles and runs sample RPC.
- [ ] Documentation explains usage, guards/interceptors for RLS.

## Definition of Done

Generator implemented, tests passing, docs updated, sample project validated.

## Scope

### In-Scope

- New generator logic for TypeORM + Nest wrappers
- Tests verifying output
- Documentation

### Out-of-Scope

- Demo app (#151)

### Deliverables

- **Est. Lines of Code:** 900-1200
- **Est. Blast Radius:** generator package, host integration, docs

## Implementation Details

### High-Level Approach

Translate IR to TypeORM entities, generate Nest module/service scaffolding, integrate with config, and ensure RPC wrappers respect RLS context.

### Affected Areas

- packages/wesley-generator-nest (new)
- Config/CLI
- Docs

### Implementation Steps

- [ ] Define mapping from IR to TypeORM entities + Nest services.
- [ ] Implement generator and expose via config.
- [ ] Add tests verifying generated code compiles (tsc) or passes basic checks.
- [ ] Document usage + limitations.

## Test Plan

### Happy Path

- [ ] Generated Nest project compiles and runs sample RPC.

### Edge Cases

- [ ] Auth/tenant context propagation documented.

### Failure Cases

- [ ] Unsupported directives produce explicit errors.

### Monitoring & Success Metrics

- [ ] Optional adoption tracking (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Generator | TBD | pending | |
| Sample project | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Output aligns with Nest/TypeORM conventions.

### Soft Requirements

- Provide configuration examples in docs.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Nest/TypeORM practitioners for validation.

---

## Production Notes

### Priority: 3 / 5

Expands TypeScript ecosystem support.

### Complexity: 5 / 5

Generator + framework integration.

### Estimate: 120 - 160 hours

Includes mapping, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated code diverges from best practices.
- **Mitigations:** Review with Nest experts, document limitations.
- **Rollback / Kill Switch:** Mark generator experimental until stable.
