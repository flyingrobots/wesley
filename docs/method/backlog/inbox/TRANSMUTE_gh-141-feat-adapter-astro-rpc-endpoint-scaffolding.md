# GH-141 feat(adapter): Astro RPC endpoint scaffolding

- Imported from: GitHub issue
- Issue: #141
- URL: https://github.com/flyingrobots/wesley/issues/141
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:41Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with demo issue #149 and docs updates.

# [ADAPTER-141] feat(adapter): Astro RPC endpoint scaffolding

## Overview

Generate Astro API route handlers that proxy to Wesley RPC functions with validation and RLS context support.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #149 (Astro demo)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Astro server docs, Wesley RPC architecture

## User Story

As an **Astro developer**, I want **generated API route scaffolding for Wesley RPC**, so that **I can integrate RPC endpoints without manual boilerplate**.

## Acceptance Criteria

- [ ] Adapter emits API route handlers forwarding to Wesley RPC wrappers.
- [ ] Validation and RLS context (e.g., Supabase session) handled or documented.
- [ ] Example Astro project demonstrates a working RPC endpoint.
- [ ] Documentation explains integration steps.
- [ ] Tests cover generated handlers.

## Definition of Done

Adapter implemented, tests passing, docs updated, demo validated.

## Scope

### In-Scope

- Generator for Astro API routes
- Validation/RLS context handling
- Tests/docs

### Out-of-Scope

- Demo app (#149)

### Deliverables

- **Est. Lines of Code:** 400-600
- **Est. Blast Radius:** generator package, docs, tests

## Implementation Details

### High-Level Approach

Map RPC metadata to Astro API route files, integrate context handling, and expose configuration options in manifest.

### Affected Areas

- packages/wesley-adapter-astro (new)
- Config/CLI integration
- Docs/demos

### Implementation Steps

- [ ] Design route scaffolding structure.
- [ ] Implement generator and expose via config.
- [ ] Add tests ensuring generated routes compile.
- [ ] Update docs and reference demo.

## Test Plan

### Happy Path

- [ ] Generated routes compile and respond correctly in Astro project.

### Edge Cases

- [ ] Multi-tenant context support documented.

### Failure Cases

- [ ] Missing configuration surfaces clear error.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Adapter generation | TBD | pending | |
| Sample project | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Generated code compatible with Astro API conventions.

### Soft Requirements

- Provide configuration guidance for context injection.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Astro community/maintainers.

---

## Production Notes

### Priority: 3 / 5

Expands adapter coverage.

### Complexity: 4 / 5

Generator + framework integration.

### Estimate: 80 - 120 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated code diverges from Astro conventions.
- **Mitigations:** Validate with demo and community feedback.
- **Rollback / Kill Switch:** Mark adapter experimental until stable.
