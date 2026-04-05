# GH-122 feat(realm): docker-compose rehearsal harness

- Imported from: GitHub issue
- Issue: #122
- URL: https://github.com/flyingrobots/wesley/issues/122
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:00Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:shadow-realm`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Works closely with docker scaffolding (#126) and workload replay (#124).

# [REALM-122] feat(realm): docker-compose rehearsal harness

## Overview

Provide a ready-to-run docker-compose + scripting harness to provision Shadow REALM databases, masking jobs, and workload tooling.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #126 (docker assets), #124 (replay), #123 (masking)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing REALM scripts, BLADE demo notes

## User Story

As a **maintainer**, I want **a turnkey REALM docker-compose harness**, so that **I can provision rehearsal environments locally and in CI**.

## Acceptance Criteria

- [ ] `docker-compose.realm.yml` defined with Postgres, optional pgBouncer, workload/replay services.
- [ ] Scripts under `scripts/realm/` bootstrap containers, apply schema snapshots, seed anonymized data.
- [ ] Integrates with `wesley shadow up` and CI workflows.
- [ ] Docs updated (BLADE/demo) referencing harness and environment variables.

## Definition of Done

Harness landed, scripts tested, docs updated, REALM commands targeting compose services without manual setup.

## Scope

### In-Scope

- Compose file creation
- Scripts for startup, seeding, teardown
- Docs/tests

### Out-of-Scope

- Production deployment automation

### Deliverables

- **Est. Lines of Code:** 500-700
- **Est. Blast Radius:** scripts/, docker-compose files, docs

## Implementation Details

### High-Level Approach

Define compose stack aligning with generated artifacts, provide scripts to start/stop, integrate with CLI commands, document usage.

### Affected Areas

- docker-compose configurations
- scripts/realm
- Docs (REALM guide, BLADE)

### Implementation Steps

- [ ] Draft compose file for REALM services.
- [ ] Add scripts for bootstrap/teardown and integration with CLI.
- [ ] Verify `wesley shadow run` works with compose stack.
- [ ] Update documentation and add tests/smoke instructions.

## Test Plan

### Happy Path

- [ ] Running `scripts/realm/up.sh` brings up stack and CLI connects successfully.

### Edge Cases

- [ ] Handle port conflicts/environment overrides.

### Failure Cases

- [ ] Script failures surface clear messages and cleanup.

### Monitoring & Success Metrics

- [ ] Optional CI job to ensure harness builds.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local docker | REALM stack | TBD | pending | |
| CI (optional) | Smoke job | TBD | pending | |

## Requirements

### Hard Requirements

- Harness idempotent (re-runnable).

### Soft Requirements

- Document troubleshooting tips.

### Runtime Requirements

- Compatible with Docker Compose v2.

### Dependencies & Approvals

- [ ] REALM maintainers review design.

---

## Production Notes

### Priority: 4 / 5

Enables consistent REALM rehearsals.

### Complexity: 4 / 5

Multi-service orchestration plus scripting.

### Estimate: 80 - 120 hours

Includes compose design, scripts, docs.

### Risk & Rollback

- **Primary Risks:** Compose drift vs generated assets.
- **Mitigations:** Keep harness minimal, align with generator outputs.
- **Rollback / Kill Switch:** Document manual provisioning as fallback.
