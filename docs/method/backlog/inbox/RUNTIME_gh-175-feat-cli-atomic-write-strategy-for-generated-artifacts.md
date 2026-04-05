# GH-175 feat(cli): atomic write strategy for generated artifacts

- Imported from: GitHub issue
- Issue: #175
- URL: https://github.com/flyingrobots/wesley/issues/175
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:24Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`, `pkg:wesley-cli`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Consider reusing existing temp directory utilities or leverage `fs.mkdtemp`.

# [CLI-175] feat(cli): atomic write strategy for generated artifacts

## Overview

Implement atomic file writes (temp file + rename) for CLI-generated artifacts to prevent partial outputs if the process aborts mid-write.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #176 (pg_prove integration), #188 (E2E suite)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-cli/TASKLIST.md

## User Story

As a **user running Wesley CLI**, I want **artifact writes to be atomic**, so that **partial files never appear if a command fails**.

## Acceptance Criteria

- [ ] All artifact writers (SQL, pgTAP, ops, evidence bundles) use temp file + rename strategy.
- [ ] Implementation handles directories that may not exist yet.
- [ ] Tests inject failures to confirm partially written files are not left behind.
- [ ] Documentation/CHANGELOG note added.

## Definition of Done

Atomic write helper implemented, integrated across generators, tests passing, docs updated.

## Scope

### In-Scope

- CLI writer utilities
- Tests for failure scenarios

### Out-of-Scope

- Artifact content changes

### Deliverables

- **Est. Lines of Code:** 200-300
- **Est. Blast Radius:** `packages/wesley-cli` writers, tests

## Implementation Details

### High-Level Approach

Introduce helper that writes to temp file in same directory and atomically renames; integrate with existing writer functions; ensure cross-platform compatibility.

### Affected Areas

- Writer utilities
- Generate command pipeline
- Tests mocking file failures

### Implementation Steps

- [ ] Build atomic write helper.
- [ ] Update all artifact writers to use helper.
- [ ] Add tests (unit/integration) to validate behavior.
- [ ] Update docs/changelog.

## Test Plan

### Happy Path

- [ ] Generated artifacts present and correct after successful run.

### Edge Cases

- [ ] Simulate failure mid-write; ensure final file not created or partial.
- [ ] Windows compatibility check.

### Failure Cases

- [ ] Missing directory or permissions -> helper surfaces errors clearly.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| CI | CLI | TBD | pending | |

## Requirements

### Hard Requirements

- Cross-platform atomicity where possible (rename semantics).

### Soft Requirements

- Provide configuration/escape hatch if needed.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] CLI maintainers review implementation.

---

## Production Notes

### Priority: 4 / 5

Improves reliability for CI usage.

### Complexity: 3 / 5

Moderate refactor to writer utilities.

### Estimate: 32 - 48 hours

Includes helper creation, integration, tests.

### Risk & Rollback

- **Primary Risks:** Rename semantics differ across platforms.
- **Mitigations:** Use safe temp paths, document limitations.
- **Rollback / Kill Switch:** Revert to non-atomic writes if issues arise.
