# GH-107 feat(e2e): build zero-downtime migration harness

- Imported from: GitHub issue
- Issue: #107
- URL: https://github.com/flyingrobots/wesley/issues/107
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:54Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`, `ci`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Foundation for scenario implementation (#108).

# [E2E-107] feat(e2e): build zero-downtime migration harness

## Overview

Implement the Docker Compose harness and helpers for the zero-downtime migration E2E suite.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #108 (scenarios)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: docs/specs/zero-downtime-migration-e2e.md

## User Story

As a **tester**, I want **a reusable migration harness**, so that **E2E scenarios can run against a consistent environment**.

## Acceptance Criteria

- [ ] Scaffold `packages/wesley-e2e-migrations` with docker-compose and seed scripts.
- [ ] Helper scripts run Wesley CLI against harness.
- [ ] Lock monitor/metrics utilities (pg_locks polling) available.
- [ ] README documents usage referencing the spec.
- [ ] Harness boots via `docker compose up`, seeds baseline schema/data, provides connection details for developers.

## Definition of Done

Harness implemented, scripts ready, docs updated, developers can run locally.

## Scope

### In-Scope

- Docker-compose setup
- Seed scripts and CLI helpers
- Metrics utilities
- Documentation

### Out-of-Scope

- Scenario tests (handled in #108)

### Deliverables

- **Est. Lines of Code:** 500-700
- **Est. Blast Radius:** packages/wesley-e2e-migrations, scripts, docs

## Implementation Details

### High-Level Approach

Create compose stack, seed scripts, CLI helper scripts, lock monitor utilities, document usage.

### Affected Areas

- New package for E2E harness
- scripts/ utilities
- Docs spec references

### Implementation Steps

- [ ] Scaffold package and compose file.
- [ ] Implement seed + CLI helper scripts.
- [ ] Add lock monitor/metrics utilities.
- [ ] Write README instructions.

## Test Plan

### Happy Path

- [ ] `docker compose up` brings up stack; seed runs successfully.

### Edge Cases

- [ ] Ports conflicts documented.

### Failure Cases

- [ ] Scripts fail gracefully with clear errors.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local docker | Harness | TBD | pending | |

## Requirements

### Hard Requirements

- Harness idempotent; easy to tear down.

### Soft Requirements

- Provide connection info for manual debugging.

### Runtime Requirements

- Requires Docker Compose.

### Dependencies & Approvals

- [ ] Infra review for compose layout.

---

## Production Notes

### Priority: 4 / 5

Prerequisite for migration E2E tests.

### Complexity: 4 / 5

Multi-service orchestration and scripting.

### Estimate: 80 - 120 hours

Includes setup, scripts, docs.

### Risk & Rollback

- **Primary Risks:** Harness drift vs production-like env.
- **Mitigations:** Keep minimal; align with spec; update as needed.
- **Rollback / Kill Switch:** Document manual setup as fallback.
