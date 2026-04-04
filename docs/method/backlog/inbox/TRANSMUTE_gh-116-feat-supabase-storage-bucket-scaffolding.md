# GH-116 feat(supabase): Storage bucket scaffolding

- Imported from: GitHub issue
- Issue: #116
- URL: https://github.com/flyingrobots/wesley/issues/116
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:23Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:supabase-platform`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Align with deploy automation (#133) for storage assets.

# [SUPA-116] feat(supabase): Storage bucket scaffolding

## Overview

Generate Supabase Storage configuration (buckets, policies) from GraphQL directives to complete the Supabase platform story.

## References & Assets

This template is perfect for documenting implementation tasks!

- [x] Other Assets: Supabase Storage docs, existing directives metadata

## User Story

As a **Supabase user**, I want **storage bucket scaffolding generated**, so that **storage setup stays in sync with the schema**.

## Acceptance Criteria

- [ ] Directives/metadata describe buckets, access rules, lifecycles.
- [ ] Generator emits SQL/config for Supabase Storage migrations.
- [ ] pgTAP coverage added for bucket policies where feasible.
- [ ] CLI flag outputs storage artifacts alongside SQL.
- [ ] Docs updated with storage how-to and examples.
- [ ] Example project demonstrates bucket generation.

## Definition of Done

Storage generator implemented, tests passing, docs updated, example validated.

## Scope

### In-Scope

- Directives for storage configuration
- Generator emitting SQL/config
- Tests/docs/examples

### Out-of-Scope

- Edge function integration (handled separately)

### Deliverables

- **Est. Lines of Code:** 600-800
- **Est. Blast Radius:** Supabase generator modules, docs, tests, examples

## Implementation Details

### High-Level Approach

Define storage directives, map to Supabase Storage config/SQL, integrate into CLI, add tests, update docs.

### Affected Areas

- Supabase generator
- CLI target options
- Docs/examples

### Implementation Steps

- [ ] Specify directives and schema mapping.
- [ ] Implement generator to emit storage SQL/config.
- [ ] Add tests and update docs.
- [ ] Update example project.

## Test Plan

### Happy Path

- [ ] Generated storage config applies successfully in Supabase project.

### Edge Cases

- [ ] Bucket-level access rules handle multi-tenant contexts.

### Failure Cases

- [ ] Invalid directives produce clear errors.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Storage generator | TBD | pending | |
| Sample project | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Configuration aligns with Supabase Storage APIs.

### Soft Requirements

- Provide customization guidance for advanced policies.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Coordination with Supabase platform team.

---

## Production Notes

### Priority: 3 / 5

Completes Supabase platform coverage.

### Complexity: 4 / 5

Generator + SQL/policy mapping.

### Estimate: 80 - 120 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Policy mismatches causing access issues.
- **Mitigations:** Validate with sample project, document limitations.
- **Rollback / Kill Switch:** Feature flag to disable storage generation until stable.
