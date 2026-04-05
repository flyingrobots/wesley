# GH-164 ci: add generate + blade smoke step

- Imported from: GitHub issue
- Issue: #164
- URL: https://github.com/flyingrobots/wesley/issues/164
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:17Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `ci`, `tests`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Reuse existing fixtures to minimize runtime.

# [CI-164] ci: add generate + blade smoke step

## Overview

Add a CI workflow step that runs `wesley generate` on the example schema and `wesley blade --dry-run` to detect regressions in the core pipeline.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #188 (E2E suite)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: TASKLIST entry, existing example fixtures

## User Story

As a **maintainer**, I want **smoke tests for generate/blade flows in CI**, so that **core regressions surface immediately**.

## Acceptance Criteria

- [ ] CI workflow runs `wesley generate` against sample schema and fails on errors.
- [ ] CI workflow runs `wesley blade --dry-run` and verifies exit status.
- [ ] Workflow kept lightweight (runtime < 5 minutes).
- [ ] Documentation updated to reference the new check.

## Definition of Done

Smoke step merged into primary CI, green on main branch, and documented in CONTRIBUTING/README.

## Scope

### In-Scope

- GitHub Actions workflow updates
- Example fixture usage

### Out-of-Scope

- Full E2E test suite (covered by #188)

### Deliverables

- **Est. Lines of Code:** 50-100 (workflow YAML)
- **Est. Blast Radius:** `.github/workflows/*`

## Implementation Details

### High-Level Approach

Add new workflow or job to existing pipeline, install dependencies, run commands, cache pnpm if needed, and ensure `--dry-run` prevents side effects.

### Affected Areas

- CI workflows
- Possibly package install caching

### Implementation Steps

- [ ] Configure workflow with pnpm install + build prerequisites.
- [ ] Run `wesley generate` on example schema.
- [ ] Run `wesley blade --dry-run`.
- [ ] Upload logs/artifacts if failure occurs.
- [ ] Document workflow in repo docs.

## Test Plan

### Happy Path

- [ ] Workflow passes on current main branch.

### Edge Cases

- [ ] Ensure workflow fails on command errors.

### Failure Cases

- [ ] Simulate failure to verify logs surfaced.

### Monitoring & Success Metrics

- [ ] Track job duration and reliability in GitHub Actions UI.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| GitHub Actions | Smoke job | TBD | pending | |

## Requirements

### Hard Requirements

- Keep job runtime minimal (<5 min).

### Soft Requirements

- Reuse caches for dependencies.

### Runtime Requirements

- Works on ubuntu-latest.

### Dependencies & Approvals

- [ ] CI owners review workflow addition.

---

## Production Notes

### Priority: 4 / 5

Provides fast feedback for core flows.

### Complexity: 2 / 5

Workflow scripting.

### Estimate: 8 - 12 hours

Includes workflow setup and verification.

### Risk & Rollback

- **Primary Risks:** Longer CI times.
- **Mitigations:** Cache dependencies, run minimal commands.
- **Rollback / Kill Switch:** Disable workflow job if it becomes problematic.
