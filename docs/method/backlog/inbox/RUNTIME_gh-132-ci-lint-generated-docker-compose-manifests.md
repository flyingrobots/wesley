# GH-132 ci: lint generated docker-compose manifests

- Imported from: GitHub issue
- Issue: #132
- URL: https://github.com/flyingrobots/wesley/issues/132
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:26Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:devops-scaffolding`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Coordinate with docker scaffolding tasks (#126) to ensure artifacts exist pre-lint.

# [CI-132] ci: lint generated docker-compose manifests

## Overview

Add a CI job that lints generated docker-compose files to catch syntax regressions before release.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #126 (docker assets)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: docker-compose gen outputs

## User Story

As a **maintainer**, I want **docker-compose manifests linted in CI**, so that **generated assets don’t drift into invalid states**.

## Acceptance Criteria

- [ ] CI workflow runs `docker compose config` (or equivalent) against generated compose files and fails on errors.
- [ ] Optional: example smoke test using `docker compose up --exit-code-from` for example project.
- [ ] Documentation updated with instructions to run lint locally.

## Definition of Done

CI job merged, passing on main, documented for contributors.

## Scope

### In-Scope

- CI workflow addition
- Optional smoke test
- Docs

### Out-of-Scope

- Generation of docker assets (handled elsewhere)

### Deliverables

- **Est. Lines of Code:** 50-100 (workflow YAML)
- **Est. Blast Radius:** .github/workflows, docs

## Implementation Details

### High-Level Approach

Add workflow step after compose generation to run lint, optionally run smoke container, document commands.

### Affected Areas

- GitHub Actions workflows
- Docs for docker scaffolding

### Implementation Steps

- [ ] Configure workflow with dependencies (Docker).
- [ ] Run `docker compose config` on generated files.
- [ ] (Optional) run smoke command for example.
- [ ] Update docs README.

## Test Plan

### Happy Path

- [ ] Workflow passes on current main.

### Edge Cases

- [ ] Fails correctly on invalid compose file (simulate).

### Failure Cases

- [ ] Document failure outputs for troubleshooting.

### Monitoring & Success Metrics

- [ ] Track job duration and reliability.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| GitHub Actions | Compose lint job | TBD | pending | |

## Requirements

### Hard Requirements

- Lint runs in CI without flakiness.

### Soft Requirements

- Provide local lint instructions.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] DevOps scaffolding owners review workflow.

---

## Production Notes

### Priority: 3 / 5

Guards generated infra assets.

### Complexity: 2 / 5

Workflow scripting.

### Estimate: 8 - 12 hours

Includes workflow setup and verification.

### Risk & Rollback

- **Primary Risks:** Increased CI duration.
- **Mitigations:** Keep job lightweight.
- **Rollback / Kill Switch:** Disable workflow job if problematic.
