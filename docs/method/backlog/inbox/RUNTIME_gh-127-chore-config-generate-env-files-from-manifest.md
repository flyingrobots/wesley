# GH-127 chore(config): generate env files from manifest

- Imported from: GitHub issue
- Issue: #127
- URL: https://github.com/flyingrobots/wesley/issues/127
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:30Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:config-orchestration`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Coordinate with config/dockers tasks (#125, #126) to ensure consistency.

# [CONFIG-127] chore(config): generate env files from manifest

## Overview

Automatically generate `.env`/`.env.realm` files based on `wesley.config`, keeping Docker Compose and REALM scripts in sync without manual edits.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #125 (manifest), #126 (docker scaffolding)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing env templates, config schema

## User Story

As a **Wesley operator**, I want **env files generated from the manifest**, so that **Docker and REALM scripts use consistent DSNs and secrets**.

## Acceptance Criteria

- [ ] `wesley transform` (with manifest) emits/updates `.env` files when required.
- [ ] Supports `.env.realm` or additional env variants for REALM.
- [ ] Respects user overrides (e.g., `.env.local`).
- [ ] docker-compose and REALM harness defaults use generated envs.
- [ ] Tests cover env emission for representative manifests.
- [ ] Docs describe env file maintenance.

## Definition of Done

Env generation integrated, tests passing, docs updated, and existing tooling reading the generated env files.

## Scope

### In-Scope

- Env file generation and update logic
- Integration with CLI/manifest flow
- Docs/tests

### Out-of-Scope

- Secrets management beyond env generation (future work)

### Deliverables

- **Est. Lines of Code:** 300-400
- **Est. Blast Radius:** CLI/config modules, docs, tests

## Implementation Details

### High-Level Approach

Parse manifest, produce env key/value files (with comments), integrate generation into transform/init, and ensure idempotent updates respecting overrides.

### Affected Areas

- Config parsing utilities
- CLI commands (transform/init)
- Docs and workflows relying on env

### Implementation Steps

- [ ] Define env templates for supported targets.
- [ ] Implement generator writing env files atomically.
- [ ] Hook into transform/init flows.
- [ ] Add tests and update docs.

## Test Plan

### Happy Path

- [ ] Manifest with postgres/supabase produces correct env files.

### Edge Cases

- [ ] Existing `.env` with custom values preserved.
- [ ] Manifest toggling targets removes relevant env entries (document behaviour).

### Failure Cases

- [ ] Invalid manifest results in clear error.

### Monitoring & Success Metrics

- [ ] Optional future telemetry.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Env generator | TBD | pending | |
| Integration | transform/init flow | TBD | pending | |

## Requirements

### Hard Requirements

- Generated env files never overwrite user `.env.local` overrides.

### Soft Requirements

- Annotate generated sections with comments for clarity.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Config/dockers maintainers review design.

---

## Production Notes

### Priority: 4 / 5

Ensures manifests drive consistent environments.

### Complexity: 4 / 5

Cross-cutting integration.

### Estimate: 60 - 80 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Overwriting user env values.
- **Mitigations:** Respect `.env.local`, back up existing files.
- **Rollback / Kill Switch:** Opt-out flag to disable env generation temporarily.
