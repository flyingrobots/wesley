# GH-136 feat(adapter): Remix RPC loader scaffolding

- Imported from: GitHub issue
- Issue: #136
- URL: https://github.com/flyingrobots/wesley/issues/136
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:38Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with any planned Remix demo (follow-up issue) for validation.

# [ADAPTER-136] feat(adapter): Remix RPC loader scaffolding

## Overview

Generate Remix loaders/actions that map to Wesley RPC functions while preserving RLS context and evidence requirements.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [ ] Related Issues / PRs: forthcoming demo issue
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Remix docs, Wesley RPC metadata

## User Story

As a **Remix developer**, I want **generated loaders/actions for Wesley RPC**, so that **I can integrate Wesley with minimal boilerplate and consistent security**.

## Acceptance Criteria

- [ ] Adapter emits Remix `loader`/`action` scaffolding for each RPC.
- [ ] Generated code handles Supabase session injection or pluggable context for RLS.
- [ ] TypeScript types generated from QIR outputs.
- [ ] Documentation covers integration with Remix routing.
- [ ] Tests cover invocation path.

## Definition of Done

Adapter implemented, tests passing, docs updated, demo (future) validates behaviour.

## Scope

### In-Scope

- Remix adapter generator
- Context handling and types
- Documentation/tests

### Out-of-Scope

- Demo application (separate issue)

### Deliverables

- **Est. Lines of Code:** 450-650
- **Est. Blast Radius:** generator package, docs, tests

## Implementation Details

### High-Level Approach

Map RPC metadata to Remix loader/action files, integrate context injection, provide config options, and ensure generated types align with QIR outputs.

### Affected Areas

- packages/wesley-adapter-remix (new)
- Config/CLI integration
- Docs

### Implementation Steps

- [ ] Design loader/action scaffolding structure.
- [ ] Implement generator and expose via config.
- [ ] Add tests verifying generated code compiles/executes.
- [ ] Update docs with usage instructions.

## Test Plan

### Happy Path

- [ ] Generated loaders/actions compile and run basic RPC call.

### Edge Cases

- [ ] RLS context (sessions) documented/handled.

### Failure Cases

- [ ] Missing config leads to clear error message.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Adapter generation | TBD | pending | |

## Requirements

### Hard Requirements

- Generated code adheres to Remix conventions.

### Soft Requirements

- Provide guidance for customizing loaders/actions.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Remix practitioners for validation.

---

## Production Notes

### Priority: 3 / 5

Expands adapter coverage.

### Complexity: 4 / 5

Generator + framework integration.

### Estimate: 80 - 120 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated code diverges from Remix best practices.
- **Mitigations:** Validate with demo, gather feedback.
- **Rollback / Kill Switch:** Mark adapter experimental until stable.
