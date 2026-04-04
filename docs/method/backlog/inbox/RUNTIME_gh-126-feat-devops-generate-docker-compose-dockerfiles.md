# GH-126 feat(devops): generate docker-compose & Dockerfiles

- Imported from: GitHub issue
- Issue: #126
- URL: https://github.com/flyingrobots/wesley/issues/126
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:28Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:devops-scaffolding`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Work with config env generation (#127) and compose lint job (#132) to ensure end-to-end coherence.

# [DEVOPS-126] feat(devops): generate docker-compose & Dockerfiles

## Overview

Allow Wesley to emit Dockerfiles and docker-compose manifests aligned with generated schema targets (Postgres, Supabase adapters, REALM rehearsal stack).

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #127 (env generation), #132 (compose lint), #122 (REALM harness)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Example compose files, Supabase references

## User Story

As a **developer adopting Wesley**, I want **Docker/Docker Compose scaffolding generated automatically**, so that **I can bring up Postgres/Supabase/REALM environments without manual config**.

## Acceptance Criteria

- [ ] When enabled via config, generator emits Dockerfiles for relevant services (supabase-db, shadow-realm, holmes runner, etc.).
- [ ] Produces docker-compose templates wiring generated SQL, evidence jobs, and REALM harness together.
- [ ] DSNs, ports, secrets parameterized via env files with safe defaults.
- [ ] Example project demonstrates `docker compose up` booting the full stack.
- [ ] Tests or smoke checks validate compose syntax.
- [ ] Documentation explains usage for local dev and CI.

## Definition of Done

Docker scaffolding generator shipped, tests passing, docs updated, and demo validated.

## Scope

### In-Scope

- Dockerfile and docker-compose template generation
- Integration with config/env generation
- Docs/tests

### Out-of-Scope

- Production-grade deployment tooling (future)

### Deliverables

- **Est. Lines of Code:** 800-1100
- **Est. Blast Radius:** generator packages, template assets, docs, tests

## Implementation Details

### High-Level Approach

Use manifest to determine needed services, render template files (Dockerfiles, compose), integrate with env generation (#127), and add tests.

### Affected Areas

- New devops generator module
- Config manifest integration
- Docs and examples

### Implementation Steps

- [ ] Design templates for services/compose.
- [ ] Implement generator linking manifest targets to templates.
- [ ] Integrate with env generation for secrets/ports.
- [ ] Add tests (lint via #132), update docs.

## Test Plan

### Happy Path

- [ ] Example project `docker compose up` succeeds using generated files.

### Edge Cases

- [ ] Optional services toggled off -> templates adjust accordingly.

### Failure Cases

- [ ] Missing env values -> generator surfaces clear errors.

### Monitoring & Success Metrics

- [ ] Optional telemetry (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local docker | Generated stack | TBD | pending | |
| CI lint | Compose lint job | TBD | pending | |

## Requirements

### Hard Requirements

- Generated files idempotent and safe to regenerate.

### Soft Requirements

- Provide comments in templates for customization.

### Runtime Requirements

- Compatible with Docker Compose v2.

### Dependencies & Approvals

- [ ] DevOps scaffolding maintainers review templates.

---

## Production Notes

### Priority: 4 / 5

Key part of “full stack compiler” story.

### Complexity: 5 / 5

Multiple templates, config integration, testing.

### Estimate: 120 - 160 hours

Includes design, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Generated stack may diverge from best practices.
- **Mitigations:** Iterate with feedback, document limitations.
- **Rollback / Kill Switch:** Feature flag to disable generation if issues arise.
