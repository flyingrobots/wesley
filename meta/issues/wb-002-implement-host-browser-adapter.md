---

## Additional Notes

Coordinate closely with WB-003 to ensure bundling expectations stay aligned; share type definitions via `packages/wesley-core`.

## Dependencies

- **Blocked by:** [WB-001](./wb-001-browser-adapter-spike.md)
- **Blocks:** [WB-004](./wb-004-browser-playground-ui.md)

# [WB-002] Implement @wesley/host-browser Adapter

## Overview

Build the production-ready browser host that wires Wesley's core ports to in-memory primitives and optional browser caching, exposing a stable API (e.g., `transform({ sdl, options })`) that mirrors the Node host.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: `docs/features/host-browser.md`
- [ ] Related Issues / PRs: WB-001, WB-003, WB-004
- [ ] Feature Flags / Experiments: n/a
- [ ] Other Assets: `meta/milestones/wesley-in-the-browser.md`

## User Story

As a **developer exploring Wesley**, I want **to run transformations client-side without installing Node**, so that **I can evaluate the product instantly in my browser**.

## Acceptance Criteria

- [ ] New package `@wesley/host-browser` exports typed APIs for transform/plan/test generation.
- [ ] Adapter uses dependency-injected storage providers (default in-memory, optional IndexedDB).
- [ ] Core test suite runs in a browser-compatible environment (Web Test Runner or Vitest + jsdom) and passes.
- [ ] Documentation updated with usage examples and limitations.

## Definition of Done

Adapter published (or ready for publish), automated tests in CI, documentation merged, and demo integration unblocked.

## Scope

### In-Scope

- Implementing browser host interfaces
- Wiring storage/cache abstractions
- Adding CI test matrix for browsers

### Out-of-Scope

- UI playground (WB-004)
- Packaging/bundling optimizations (WB-003)

### Deliverables

- **Est. Lines of Code:** 600-900 (new package + tests)
- **Est. Blast Radius:** `packages/wesley-core`, `packages/wesley-host-browser`, ci workflows

## Implementation Details

### High-Level Approach

Reuse existing hexagonal ports, create browser-specific adapters (e.g., in-memory FS, fetch-based loaders), and ensure the adapter can run without synchronous fs/process APIs. Provide type-safe wrappers around config options.

### Affected Areas

- packages/wesley-core (minor adjustments if needed)
- packages/wesley-host-browser (new)
- .github/workflows (browser test job)

### Implementation Steps

- [ ] Scaffold `packages/wesley-host-browser` with build/test configs.
- [ ] Implement storage abstractions (memory + IndexedDB backend) and plug into core ports.
- [ ] Add adapter tests mirroring Node host fixture coverage using Web Test Runner.
- [ ] Update docs and usage examples.

## Test Plan

### Happy Path

- [ ] Transform sample SDL yields identical artifacts vs Node host (text diff).

### Edge Cases

- [ ] Large schema (~5MB) processed without crashes.
- [ ] Offline mode handled gracefully (fallback to in-memory cache).

### Failure Cases

- [ ] Invalid SDL throws consistent errors with meaningful messages.

### Monitoring & Success Metrics

- [ ] Browser CI job green on Chrome + Firefox.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Chrome Stable | Playground API | TBD | pending | |
| Firefox Stable | Playground API | TBD | pending | |

## Requirements

### Hard Requirements

- API parity with Node host for supported features.

### Soft Requirements

- Minimize bundle size by tree-shaking optional features.

### Runtime Requirements

- Must run under strict mode and modern browsers (Chrome/Firefox/Safari latest).

### Dependencies & Approvals

- [ ] WB-001 completed
- [ ] RFC accepted

---

## Production Notes

### Priority: 5 / 5

Core implementation for milestone.

### Complexity: 4 / 5

Significant new package + cross-environment testing.

### Estimate: 80 - 120 hours

Includes development, tests, and iterations on feedback.

### Risk & Rollback

- **Primary Risks:** Hidden Node assumptions, IndexedDB quirks.
- **Mitigations:** Feature flag caching backend; fallback to in-memory.
- **Rollback / Kill Switch:** Ship adapter behind experimental flag; document opt-in.
