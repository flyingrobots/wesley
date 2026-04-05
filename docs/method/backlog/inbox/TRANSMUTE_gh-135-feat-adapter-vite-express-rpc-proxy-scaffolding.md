# GH-135 feat(adapter): Vite/express RPC proxy scaffolding

- Imported from: GitHub issue
- Issue: #135
- URL: https://github.com/flyingrobots/wesley/issues/135
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:36Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Consider supporting both Express and Fastify if feasible.

# [ADAPTER-135] feat(adapter): Vite/express RPC proxy scaffolding

## Overview

Provide an adapter that generates RPC proxy routes for Vite + Express setups so browser clients can call Wesley RPC functions without custom glue.

## References & Assets

This template is perfect for documenting implementation tasks!

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [ ] Related Issues / PRs: future demo issue
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Wesley RPC metadata, Express/Vite guides

## User Story

As a **developer using Vite + Express**, I want **generated proxy routes for Wesley RPC**, so that **my frontend can call RPCs without manual wiring**.

## Acceptance Criteria

- [ ] Adapter emits Express route handlers mapping HTTP endpoints to RPC wrappers.
- [ ] Implements session/context injection for RLS (e.g., Supabase JWT extraction).
- [ ] Optional Vite configuration snippet provided for local proxying.
- [ ] Documentation covers setup and RLS considerations.
- [ ] Tests compile generated handlers and exercise sample request.

## Definition of Done

Adapter implemented, tests passing, docs updated, and example usage validated.

## Scope

### In-Scope

- Express proxy generator
- Context handling
- Docs/tests

### Out-of-Scope

- Demo app (follow-up issue)

### Deliverables

- **Est. Lines of Code:** 400-600
- **Est. Blast Radius:** generator package, docs, tests

## Implementation Details

### High-Level Approach

Use RPC metadata to generate Express route handlers, optionally include middleware for context, provide Vite proxy snippet, integrate into config.

### Affected Areas

- packages/wesley-adapter-vite-express (new)
- Config/CLI integration
- Docs

### Implementation Steps

- [ ] Design handler template and context injection.
- [ ] Implement generator + config integration.
- [ ] Add tests verifying handlers compile.
- [ ] Update docs with setup instructions.

## Test Plan

### Happy Path

- [ ] Generated routes compile and respond to sample RPC call.

### Edge Cases

- [ ] Multi-tenant context documented/handled.

### Failure Cases

- [ ] Missing config results in clear error.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Adapter generation | TBD | pending | |

## Requirements

### Hard Requirements

- Generated code follows Express conventions; Vite integration optional but documented.

### Soft Requirements

- Provide guidance for Fastify adaptation (if not implemented).

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Express/Vite practitioners.

---

## Production Notes

### Priority: 3 / 5

Supports broader adapter coverage.

### Complexity: 4 / 5

Generator + server integration.

### Estimate: 60 - 80 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated code diverges from best practices.
- **Mitigations:** Validate with sample project, note limitations.
- **Rollback / Kill Switch:** Mark adapter experimental until stable.
