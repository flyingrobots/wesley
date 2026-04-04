# GH-128 feat(cli): wesley init project scaffolding

- Imported from: GitHub issue
- Issue: #128
- URL: https://github.com/flyingrobots/wesley/issues/128
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:31Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:config-orchestration`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Reuse scaffolding assets from docker/config tasks (#126, #132) where possible.

# [CLI-128] feat(cli): wesley init project scaffolding

## Overview

Add a `wesley init` command that scaffolds a new project (schema, config, docker compose, example ops) so teams can bootstrap Wesley quickly.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #126 (docker assets), #132 (compose lint)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing Quick Start, example fixtures

## User Story

As a **new Wesley user**, I want **a CLI command that scaffolds the full project**, so that **I can start transforming/plan/rehearse without manual setup**.

## Acceptance Criteria

- [ ] `wesley init` prompts for targets (postgres, supabase, typescript, zod, prisma, etc.) or accepts flags.
- [ ] Generates starter files: `schema.graphql`, `wesley.config.yaml`, docker-compose, example ops/tests.
- [ ] Generated project runs `wesley transform/plan/rehearse` successfully.
- [ ] Tests cover default scaffold and custom target combinations.
- [ ] Quick Start guide updated to reference command.

## Definition of Done

Init command merged, tests passing, docs updated, changelog entry added.

## Scope

### In-Scope

- CLI command scaffolding
- Template assets
- Docs/tests

### Out-of-Scope

- Advanced custom templates (future work)

### Deliverables

- **Est. Lines of Code:** 600-800
- **Est. Blast Radius:** CLI command modules, template assets, docs

## Implementation Details

### High-Level Approach

Bundle template files, prompt user for options, generate project structure, run optional validation. Use atomic writes and config validation.

### Affected Areas

- packages/wesley-cli (new command)
- Template assets directory
- Docs (Quick Start)

### Implementation Steps

- [ ] Design prompt/flag flow.
- [ ] Assemble template assets (schema, config, docker, ops).
- [ ] Implement command with scaffolding logic.
- [ ] Add tests and update docs.

## Test Plan

### Happy Path

- [ ] Running `wesley init` produces project that passes `wesley transform` etc.

### Edge Cases

- [ ] Non-empty dir warning, force option.
- [ ] Invalid target combo blocked via config validation.

### Failure Cases

- [ ] Missing dependencies surfaced clearly.

### Monitoring & Success Metrics

- [ ] Optional telemetry (future) on init usage.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | CLI command | TBD | pending | |

## Requirements

### Hard Requirements

- Works cross-platform.
- Uses atomic writes for generated files.

### Soft Requirements

- Provide README snippet or follow-up instructions.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] CLI maintainers review design.

---

## Production Notes

### Priority: 4 / 5

Key onboarding feature.

### Complexity: 5 / 5

Multiple templates + prompts + validation.

### Estimate: 120 - 160 hours

Includes design, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated project outdated over time.
- **Mitigations:** Keep templates minimal, document maintenance plan.
- **Rollback / Kill Switch:** Disable command or mark experimental if issues arise.
