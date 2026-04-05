# GH-159 feat(generator): wire generator-js emit wrappers into host runtime

- Imported from: GitHub issue
- Issue: #159
- URL: https://github.com/flyingrobots/wesley/issues/159
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:55Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `feature`, `pkg:wesley-generator-js`, `pkg:wesley-host-node`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with CLI issue #160 for end-to-end command restoration.

# [GEN-159] feat(generator): wire generator-js emit wrappers into host runtime

## Overview

Expose `emitModels/emitZod/emitTs` helpers in `@wesley/generator-js` and hook them through `createNodeRuntime` so the CLI can invoke them without internal imports.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #160 (CLI commands)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: generator-js codebase, host-node runtime

## User Story

As a **CLI developer**, I want **first-class generator-js emit helpers exposed**, so that **the CLI can call them cleanly without reaching into internals**.

## Acceptance Criteria

- [ ] `@wesley/generator-js` exports `emitModels`, `emitZod`, `emitTs` helpers.
- [ ] Host runtime (`createNodeRuntime`) exposes these helpers.
- [ ] Tests cover helper exports and basic usage.
- [ ] Documentation updated (package README / API docs).

## Definition of Done

Helpers exported, runtime integration complete, tests passing, docs updated.

## Scope

### In-Scope

- generator-js exports
- host-node runtime wiring
- Tests/docs

### Out-of-Scope

- CLI command implementation (handled in #160)

### Deliverables

- **Est. Lines of Code:** 200-300
- **Est. Blast Radius:** generator-js package, host-node runtime, tests

## Implementation Details

### High-Level Approach

Expose helpers in generator-js index, update runtime to include methods, ensure type definitions align, add tests verifying functions callable end-to-end.

### Affected Areas

- packages/wesley-generator-js
- packages/wesley-host-node runtime
- Tests / docs

### Implementation Steps

- [ ] Export helper functions from generator-js.
- [ ] Update runtime to inject helpers.
- [ ] Add tests verifying helpers called via runtime.
- [ ] Update documentation.

## Test Plan

### Happy Path

- [ ] Import helpers via runtime and run sample generation.

### Edge Cases

- [ ] Error handling when schema invalid.

### Failure Cases

- [ ] Missing helper exports should cause tests to fail.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | generator-js/runtime | TBD | pending | |

## Requirements

### Hard Requirements

- Maintain backwards compatibility for existing exports.

### Soft Requirements

- Provide TypeScript typings for new helpers.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] generator-js maintainers review exports.

---

## Production Notes

### Priority: 4 / 5

Unblocks CLI command work.

### Complexity: 3 / 5

Moderate export + runtime wiring.

### Estimate: 32 - 48 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Breaking existing imports.
- **Mitigations:** Keep exports additive, add tests.
- **Rollback / Kill Switch:** Revert export additions if issues arise.
