# GH-117 feat(supabase): Realtime channel configuration

- Imported from: GitHub issue
- Issue: #117
- URL: https://github.com/flyingrobots/wesley/issues/117
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:25Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:supabase-platform`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Works with Supabase Edge (118) and deploy automation (133).

# [SUPA-117] feat(supabase): Realtime channel configuration

## Overview

Compile Supabase Realtime channel definitions and security rules from GraphQL directives so subscriptions stay in sync with the schema.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #118, #133
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Supabase Realtime docs, Wesley directives

## User Story

As a **Supabase user**, I want **generated realtime channel config**, so that **subscriptions and RLS policies stay aligned with my schema**.

## Acceptance Criteria

- [ ] Directives/config opt tables/operations into realtime generation.
- [ ] CLI emits SQL/config to register channels and RLS-compatible filters.
- [ ] Rehearsal/tests validate channel creation and basic event flow.
- [ ] Docs explain enabling realtime and caveats (cold start, auth).

## Definition of Done

Realtime generator implemented, tests passing, docs updated, examples validated.

## Scope

### In-Scope

- Directive handling
- SQL/config generation
- Tests/docs

### Out-of-Scope

- Client SDK integration (documented separately)

### Deliverables

- **Est. Lines of Code:** 600-800
- **Est. Blast Radius:** Supabase generator modules, docs, tests

## Implementation Details

### High-Level Approach

Use directives to determine realtime channels, generate SQL/config for Supabase realtime, ensure RLS filters align, integrate with CLI.

### Affected Areas

- Supabase generator
- CLI target configuration
- Docs/examples

### Implementation Steps

- [ ] Define directive semantics for realtime.
- [ ] Implement generator to emit SQL/config.
- [ ] Add tests verifying channels created and events emitted in rehearsal.
- [ ] Update documentation.

## Test Plan

### Happy Path

- [ ] Generated channels tested in sample Supabase project.

### Edge Cases

- [ ] Multi-tenant scenarios ensure filters correct.

### Failure Cases

- [ ] Invalid directives produce helpful errors.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Realtime generator | TBD | pending | |
| Sample project | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Align output with Supabase realtime API.

### Soft Requirements

- Provide guidance for customizing channel filters.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Coordination with Supabase platform team.

---

## Production Notes

### Priority: 3 / 5

Completes Supabase platform support.

### Complexity: 4 / 5

Generator + SQL + tests.

### Estimate: 80 - 120 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated filters misaligned with RLS.
- **Mitigations:** Validate with sample project, document limitations.
- **Rollback / Kill Switch:** Feature flag to disable realtime generation until stable.
