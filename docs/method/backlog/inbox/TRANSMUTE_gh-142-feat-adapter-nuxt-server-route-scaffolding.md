# GH-142 feat(adapter): Nuxt server route scaffolding

- Imported from: GitHub issue
- Issue: #142
- URL: https://github.com/flyingrobots/wesley/issues/142
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:42Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with the Nuxt demo issue (#150) to validate the adapter.

# [ADAPTER-142] feat(adapter): Nuxt server route scaffolding

## Overview

Generate Nuxt 3 server routes and composables that call Wesley RPC functions with type-safe inputs and RLS context support.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #150 (Nuxt demo)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Nuxt 3 docs, Wesley RPC architecture

## User Story

As a **Nuxt developer**, I want **scaffolded server routes and composables for Wesley RPC**, so that **I can integrate Wesley into my Nuxt app quickly with type safety**.

## Acceptance Criteria

- [ ] Adapter emits `server/api/*` routes forwarding to Wesley RPC wrappers.
- [ ] Composable helpers generated for client usage with typings.
- [ ] Supabase session extraction (or configurable context) handled for multi-tenant RLS.
- [ ] Documentation updated with Nuxt integration instructions.
- [ ] Example Nuxt project demonstrates data fetch via generated routes.

## Definition of Done

Adapter emitted, tests passing, docs updated, and demo validated.

## Scope

### In-Scope

- Nuxt adapter generator implementation
- Type definitions and context handling
- Documentation and tests

### Out-of-Scope

- Demo application (#150)

### Deliverables

- **Est. Lines of Code:** 500-700
- **Est. Blast Radius:** generator package, docs, tests

## Implementation Details

### High-Level Approach

Use Wesley RPC metadata to produce Nuxt server routes and composable wrappers, incorporate context (Supabase session), and expose configuration in manifest.

### Affected Areas

- packages/wesley-adapter-nuxt (new)
- Config/CLI integration
- Docs/demos references

### Implementation Steps

- [ ] Design route/composable generation structure.
- [ ] Implement generator and integrate into config.
- [ ] Add tests verifying emitted files compile with Nuxt.
- [ ] Update docs and link to demo.

## Test Plan

### Happy Path

- [ ] Generated routes/composables pass Nuxt build.

### Edge Cases

- [ ] Multi-tenant context (Supabase session) handled or documented.

### Failure Cases

- [ ] Missing configuration results in clear error.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Adapter generation | TBD | pending | |
| Sample project | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Output must be compatible with Nuxt 3 server routes/composable conventions.

### Soft Requirements

- Provide configuration guidance for context injection.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Nuxt experts to validate best practices.

---

## Production Notes

### Priority: 3 / 5

Supports Nuxt ecosystem.

### Complexity: 4 / 5

Generator + framework-specific integration.

### Estimate: 80 - 120 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated files diverge from Nuxt conventions.
- **Mitigations:** Validate with demo, gather feedback.
- **Rollback / Kill Switch:** Mark adapter experimental until stable.
