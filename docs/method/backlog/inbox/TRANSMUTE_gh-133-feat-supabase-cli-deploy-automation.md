# GH-133 feat(supabase): CLI deploy automation

- Imported from: GitHub issue
- Issue: #133
- URL: https://github.com/flyingrobots/wesley/issues/133
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:34Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:supabase-platform`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with Supabase platform adapters to ensure generated artifacts align.

# [SUPA-133] feat(supabase): CLI deploy automation

## Overview

Provide scripts/integration to push generated Supabase artifacts via the `supabase` CLI, closing the loop for automated deployments.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: Supabase adapter tasks
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Supabase CLI docs, Wesley Supabase artifacts

## User Story

As a **Supabase user**, I want **automated deployment of generated artifacts**, so that **I can apply database/policy/function changes without manual CLI steps**.

## Acceptance Criteria

- [ ] Detect Supabase targets in `wesley.config` and emit deployment scripts (`supabase db push`, `supabase functions deploy`, etc.).
- [ ] Integrate with `wesley shadow`/release workflows for reproducibility.
- [ ] Documentation updated with environment requirements and auth setup.
- [ ] Optional CI example demonstrating dry-run deployment.

## Definition of Done

Supabase deployment automation shipped, docs updated, optional CI example working.

## Scope

### In-Scope

- Script generation/integration for Supabase CLI
- Docs/examples

### Out-of-Scope

- Changes to Supabase adapter outputs (unless needed)

### Deliverables

- **Est. Lines of Code:** 300-400
- **Est. Blast Radius:** Supabase adapter/runtime, docs, CI examples

## Implementation Details

### High-Level Approach

Inspect config for Supabase targets, generate scripts or CLI steps, integrate into existing workflows, provide docs for env setup.

### Affected Areas

- Supabase adapter modules
- CLI workflows (shadow/deploy)
- Docs/CI samples

### Implementation Steps

- [ ] Define deployment script templates.
- [ ] Integrate with CLI commands/workflows.
- [ ] Update docs with instructions.
- [ ] Optional: add example CI job.

## Test Plan

### Happy Path

- [ ] Scripts run `supabase` CLI successfully in dry-run/local mode.

### Edge Cases

- [ ] Missing CLI auth produces clear error.

### Failure Cases

- [ ] Document rollback/cleanup steps if deploy fails.

### Monitoring & Success Metrics

- [ ] Optional future telemetry for usage.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local Supabase CLI | Deployment script | TBD | pending | |
| CI (optional) | Dry-run job | TBD | pending | |

## Requirements

### Hard Requirements

- Support Supabase CLI v1+.

### Soft Requirements

- Provide customizable hooks for teams.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Coordination with Supabase adapter maintainers.

---

## Production Notes

### Priority: 3 / 5

Enhances Supabase integration story.

### Complexity: 4 / 5

Automation + workflow integration.

### Estimate: 40 - 60 hours

Includes scripting, docs, optional CI example.

### Risk & Rollback

- **Primary Risks:** Deploy scripts misconfigured.
- **Mitigations:** Provide dry-run capability and clear docs.
- **Rollback / Kill Switch:** Keep scripts optional/opt-in.
