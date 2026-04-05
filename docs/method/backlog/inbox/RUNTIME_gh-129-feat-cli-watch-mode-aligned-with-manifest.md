# GH-129 feat(cli): watch mode aligned with manifest

- Imported from: GitHub issue
- Issue: #129
- URL: https://github.com/flyingrobots/wesley/issues/129
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:32Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:config-orchestration`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Consider leveraging existing file-watcher utilities and atomic write helpers (#175).

# [CLI-129] feat(cli): watch mode aligned with manifest

## Overview

Modernize `wesley watch` so it reads `wesley.config`, performs incremental rebuilds, and atomically writes artifacts when files change.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #175 (atomic writes), QIR tasks
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Current watch command, manifest

## User Story

As a **developer iterating on schemas**, I want **`wesley watch` to rebuild affected artifacts incrementally**, so that **feedback loops stay fast and reliable**.

## Acceptance Criteria

- [ ] `wesley watch` monitors schema/config/ops/generator templates and rebuilds only affected targets.
- [ ] Atomic writes used for outputs to prevent partial artifacts.
- [ ] Integration with QIR ops to rerun EXPLAIN/pgTAP smoke when relevant.
- [ ] JSON logs available for editor integration.
- [ ] Tests cover change scenarios and artifact stability.
- [ ] Documentation updated with usage guidance.

## Definition of Done

Watch command updated, tests passing, docs/changelog updated, and references to legacy behaviour removed.

## Scope

### In-Scope

- CLI watch implementation
- Incremental build strategy
- Tests/logging/docs

### Out-of-Scope

- Additional generator features (handled elsewhere)

### Deliverables

- **Est. Lines of Code:** 500-700
- **Est. Blast Radius:** CLI watch module, writer utilities, docs

## Implementation Details

### High-Level Approach

Use file watcher to detect changes, compute dependency graph from manifest, trigger targeted rebuilds, ensure atomic outputs, and produce structured logs.

### Affected Areas

- packages/wesley-cli/watch command
- Writer utilities (atomic writes)
- Docs (CLI guide)

### Implementation Steps

- [ ] Assess current watch implementation; design incremental strategy.
- [ ] Implement manifest-aware change detection.
- [ ] Integrate atomic write helper (#175).
- [ ] Add structured logging and tests.
- [ ] Update docs/changelog.

## Test Plan

### Happy Path

- [ ] Changing schema triggers rebuild for relevant targets only.

### Edge Cases

- [ ] Simultaneous edits; ensure consistent output.
- [ ] Invalid files produce clear errors without crashing watch.

### Failure Cases

- [ ] I/O failures handled gracefully with logs.

### Monitoring & Success Metrics

- [ ] Optional telemetry for watch usage (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | Watch command | TBD | pending | |

## Requirements

### Hard Requirements

- Backward compatible CLI flags.
- Stable incremental rebuild behaviour.

### Soft Requirements

- Provide local log output for debugging.

### Runtime Requirements

- Works cross-platform.

### Dependencies & Approvals

- [ ] CLI maintainers review design.

---

## Production Notes

### Priority: 4 / 5

Improves developer experience.

### Complexity: 4 / 5

Incremental build logic.

### Estimate: 80 - 120 hours

Includes design, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Watch race conditions, incomplete rebuilds.
- **Mitigations:** Add integration tests, fallback to full rebuild on uncertainty.
- **Rollback / Kill Switch:** Provide flag to use legacy full rebuild mode temporarily.
