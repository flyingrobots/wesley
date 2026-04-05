# GH-121 feat(realm): CLI lifecycle commands

- Imported from: GitHub issue
- Issue: #121
- URL: https://github.com/flyingrobots/wesley/issues/121
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:58Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:shadow-realm`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Will integrate with docker harness (#122), workload replay (#124), and masking (#123).

# [REALM-121] feat(realm): CLI lifecycle commands

## Overview

Add a `wesley shadow` command suite (up/run/approve/down) to manage Shadow REALM rehearsal environments end-to-end.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #122, #123, #124
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing rehearse command, docs demos

## User Story

As a **release engineer**, I want **CLI lifecycle commands for Shadow REALM**, so that **I can stand up, exercise, approve, and tear down rehearsals reliably**.

## Acceptance Criteria

- [ ] `wesley shadow up` provisions shadow DB via docker-compose or configured DSN, applies migrations, seeds masked data.
- [ ] `wesley shadow run` executes plan + pgTAP + workload replay capturing metrics.
- [ ] `wesley shadow approve` records verdict into SHIPME/evidence bundles.
- [ ] `wesley shadow down` tears down environment and cleans artifacts.
- [ ] Structured logging + JSON output for CI workflows.
- [ ] Docs and demos updated to use new commands.
- [ ] Tests cover lifecycle commands (mocked environments where necessary).

## Definition of Done

Lifecycle commands merged, tests passing, docs updated, demos referencing CLI, evidence integration functional.

## Scope

### In-Scope

- CLI command suite
- Integration with docker harness, masking, replay
- Logging/JSON output
- Docs/tests

### Out-of-Scope

- Underlying docker or mask implementations (handled in companion issues)

### Deliverables

- **Est. Lines of Code:** 700-900
- **Est. Blast Radius:** CLI command modules, documentation, tests

## Implementation Details

### High-Level Approach

Create CLI command group `wesley shadow`, wire subcommands to orchestrate docker harness, apply migrations, run rehearsal, approve verdict, tear down. Ensure JSON logs available for CI.

### Affected Areas

- packages/wesley-cli (command registry)
- Scripts/integration with REALM tools
- Docs/demos

### Implementation Steps

- [ ] Implement `shadow up` orchestrating environment provisioning.
- [ ] Implement `shadow run` invoking plan/replay/pgTAP.
- [ ] Implement `shadow approve` writing evidence.
- [ ] Implement `shadow down` cleanup.
- [ ] Add structured logging and tests.
- [ ] Update docs/demos.

## Test Plan

### Happy Path

- [ ] Lifecycle commands execute sequentially with mocked environment.

### Edge Cases

- [ ] Partial failures (e.g., run fails) handled gracefully; down still works.

### Failure Cases

- [ ] Missing docker/DSN surfaces clear errors.

### Monitoring & Success Metrics

- [ ] Evidence logs show metrics after run.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | CLI commands | TBD | pending | |

## Requirements

### Hard Requirements

- Commands support both docker-based and external DSN setups.

### Soft Requirements

- Provide flags for JSON output, dry-run.

### Runtime Requirements

- Cross-platform compatibility.

### Dependencies & Approvals

- [ ] REALM maintainers review design.

---

## Production Notes

### Priority: 4 / 5

Key to delivering promised REALM workflows.

### Complexity: 5 / 5

Multiple subcommands orchestrating environment.

### Estimate: 120 - 160 hours

Includes command implementation, integration, tests, docs.

### Risk & Rollback

- **Primary Risks:** Complex orchestration failing unpredictably.
- **Mitigations:** Provide robust error handling, allow manual overrides.
- **Rollback / Kill Switch:** Keep legacy `rehearse` command available as fallback.
