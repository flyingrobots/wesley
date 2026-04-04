# GH-118 feat(supabase): Edge Function scaffolding

- Imported from: GitHub issue
- Issue: #118
- URL: https://github.com/flyingrobots/wesley/issues/118
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:26Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:supabase-platform`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with Supabase deploy automation (#133) for CI integration.

# [SUPA-118] feat(supabase): Edge Function scaffolding

## Overview

Generate Supabase Edge Function scaffolding (directory, handler templates, manifests) from Wesley directives so custom logic ships alongside the schema.

## References & Assets

This template is perfect for documenting implementation tasks!

- [x] Other Assets: Supabase Edge Function docs, Wesley directives metadata

## User Story

As a **Supabase developer**, I want **edge function scaffolding generated from my schema**, so that **custom logic deploys with the data plane**.

## Acceptance Criteria

- [ ] Support directive/metadata describing edge functions tied to tables/operations.
- [ ] Generator emits handler templates and deployment config.
- [ ] CLI flag outputs edge function artifacts.
- [ ] Integrate artifacts into HOLMES evidence (hash/signature).
- [ ] Example project includes generated edge function demonstrating flow.
- [ ] Docs explain customizing handlers and deployment.

## Definition of Done

Edge function scaffolding implemented, tests passing, docs updated, example project validated.

## Scope

### In-Scope

- Directive interpretation
- Generator for edge function files
- CLI integration
- Docs/tests

### Out-of-Scope

- Deploy automation (handled in #133)

### Deliverables

- **Est. Lines of Code:** 600-800
- **Est. Blast Radius:** Supabase generator module, CLI, docs, tests

## Implementation Details

### High-Level Approach

Use directives to define edge functions, generate TypeScript handler templates + config, integrate with CLI flag, update evidence bundle with artifact hashes.

### Affected Areas

- Supabase generator packages
- CLI command for Supabase targets
- Docs

### Implementation Steps

- [ ] Define directive metadata for edge functions.
- [ ] Implement generator producing handlers/config.
- [ ] Integrate with CLI and evidence bundle.
- [ ] Add tests and documentation.

## Test Plan

### Happy Path

- [ ] Generated edge function builds and can be deployed via Supabase CLI.

### Edge Cases

- [ ] Functions without directives ignored gracefully.

### Failure Cases

- [ ] Invalid directives -> clear errors.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Generator | TBD | pending | |
| Sample project | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Generated artifacts compatible with Supabase Edge runtime.

### Soft Requirements

- Provide examples for customizing logic.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Coordination with Supabase platform team.

---

## Production Notes

### Priority: 3 / 5

Enhances Supabase integration story.

### Complexity: 4 / 5

Generator + CLI integration.

### Estimate: 80 - 120 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated handlers may need customization; ensure template clear.
- **Mitigations:** Provide docs/examples.
- **Rollback / Kill Switch:** Keep feature behind config flag until stable.
