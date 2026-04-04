# GH-134 feat(adapter): Next.js RPC route scaffolding

- Imported from: GitHub issue
- Issue: #134
- URL: https://github.com/flyingrobots/wesley/issues/134
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:35Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with Next.js demo issue #147 and docs.

# [ADAPTER-134] feat(adapter): Next.js RPC route scaffolding

## Overview

Generate Next.js route handlers that proxy calls to Wesley RPC functions, respecting RLS context and evidence tooling.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #147 (Next.js demo)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Next.js app router/docs, Wesley RPC metadata

## User Story

As a **Next.js developer**, I want **generated API routes for Wesley RPC**, so that **my frontend can call RPC functions without manual wiring while preserving RLS**.

This template is perfect for documenting implementation tasks!

## References & Assets

- [x] Other Assets: Next.js app router/examples and Wesley RPC metadata

## Acceptance Criteria

- [ ] Adapter emits API route handlers under `app/api/...` (or `pages/api`) that call RPC wrappers.
- [ ] Supabase session (auth.uid, tenant) handled or documented for RLS context.
- [ ] Config manifest exposes options (base paths, enable/disable).
- [ ] Example app demonstrates browser → Next.js route → RPC flow respecting RLS.
- [ ] Documentation updated with guidance/caveats.

## Definition of Done

Adapter implemented, tests passing, docs updated, demo validated.

## Scope

### In-Scope

- Next.js adapter generator
- Context handling
- Docs/tests

### Out-of-Scope

- Demo app (#147)

### Deliverables

- **Est. Lines of Code:** 500-700
- **Est. Blast Radius:** generator package, docs, tests

## Implementation Details

### High-Level Approach

Use RPC metadata to generate Next.js route files, integrate context extraction, expose config options, ensure compatibility with App Router.

### Affected Areas

- packages/wesley-adapter-nextjs (new)
- Config/CLI integration
- Docs

### Implementation Steps

- [ ] Design route scaffolding structure.
- [ ] Implement generator and integrate with config.
- [ ] Add tests verifying generated routes compile.
- [ ] Update docs with setup/caveats.

## Test Plan

### Happy Path

- [ ] Generated routes compile and respond correctly in sample Next.js project.

### Edge Cases

- [ ] Support for both App Router and Pages Router (document limitations).

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

- Generated code follows Next.js conventions and TypeScript typing.

### Soft Requirements

- Provide guidance for customizing routes.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Next.js practitioners.

---

## Production Notes

### Priority: 4 / 5

High demand adapter.

### Complexity: 4 / 5

Generator + framework integration.

### Estimate: 80 - 120 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated code diverges from Next.js best practices.
- **Mitigations:** Validate with demo, gather feedback.
- **Rollback / Kill Switch:** Mark adapter experimental until stable.
