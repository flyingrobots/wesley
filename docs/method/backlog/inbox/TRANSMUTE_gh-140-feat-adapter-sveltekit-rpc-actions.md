# GH-140 feat(adapter): SvelteKit RPC actions

- Imported from: GitHub issue
- Issue: #140
- URL: https://github.com/flyingrobots/wesley/issues/140
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:39Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with demo issue #148 for validation.

# [ADAPTER-140] feat(adapter): SvelteKit RPC actions

## Overview

Generate SvelteKit `+page.server.ts`/`+server.ts` actions that call Wesley RPC functions with RLS-aware context and type-safe inputs.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #148 (SvelteKit demo)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: SvelteKit docs, Wesley RPC metadata

## User Story

As a **SvelteKit developer**, I want **generated RPC actions**, so that **I can integrate Wesley without manual wiring**.

## Acceptance Criteria

- [ ] Adapter emits server load/action helpers wired to Wesley RPC wrappers.
- [ ] Generated code includes TypeScript types from QIR outputs.
- [ ] Session extraction (Supabase or JWT) documented/handled for RLS context.
- [ ] Config manifest allows opting into SvelteKit adapter.
- [ ] Docs updated with setup instructions and limitations.

## Definition of Done

Adapter implemented, tests passing, docs updated, and demo validated.

## Scope

### In-Scope

- SvelteKit adapter generator
- Type definitions and context handling
- Docs/tests

### Out-of-Scope

- Demo app (#148)

### Deliverables

- **Est. Lines of Code:** 500-700
- **Est. Blast Radius:** generator package, docs, tests

## Implementation Details

### High-Level Approach

Leverage RPC metadata to emit `+page.server.ts`/`+server.ts` actions with typed handlers, integrate context extraction, and expose configuration options.

### Affected Areas

- packages/wesley-adapter-sveltekit (new)
- Config/CLI integration
- Docs/demos references

### Implementation Steps

- [ ] Design action generation structure.
- [ ] Implement generator and expose via config.
- [ ] Add tests verifying generated files compile with SvelteKit.
- [ ] Update docs, link to demo.

## Test Plan

### Happy Path

- [ ] Generated actions compile and execute in sample project.

### Edge Cases

- [ ] Document fallback for custom auth providers.

### Failure Cases

- [ ] Missing config surfaces clear error.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Adapter generation | TBD | pending | |
| Sample project | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Generated code aligns with SvelteKit conventions.

### Soft Requirements

- Provide instructions for customizing actions.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from SvelteKit community.

---

## Production Notes

### Priority: 3 / 5

Supports SvelteKit ecosystem.

### Complexity: 4 / 5

Generator + framework integration.

### Estimate: 80 - 120 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated actions diverge from best practices.
- **Mitigations:** Validate with demo, gather feedback.
- **Rollback / Kill Switch:** Mark adapter experimental until stable.
