# GH-137 feat(qir): attach generated Zod validators to RPC inputs

- Imported from: GitHub issue
- Issue: #137
- URL: https://github.com/flyingrobots/wesley/issues/137
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:17Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:qir-phase-c`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with RPC pipeline issues (#185, #182) to ensure metadata available.

# [QIR-137] feat(qir): attach generated Zod validators to RPC inputs

## Overview

Use generated Zod schemas to validate RPC inputs automatically before invoking SQL functions/views, ensuring client requests respect the GraphQL schema contract.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #185 (directive pipeline), #182 (RPC generator coverage)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Zod generator outputs, QIR metadata

## User Story

As a **developer invoking Wesley RPCs**, I want **runtime validation of inputs**, so that **bad payloads are rejected according to the GraphQL contract**.

## Acceptance Criteria

- [ ] RPC invocation path uses generated Zod validators (host-node + adapters).
- [ ] Validation failures return structured errors (configurable strict/warn).
- [ ] Tests cover valid and invalid payloads.
- [ ] Docs updated to explain validation flow and customization.

## Definition of Done

Validation integrated, tests passing, docs updated, HOLMES/evidence instrumentation adjusted if needed.

## Scope

### In-Scope

- Wiring Zod validators into RPC invocation pipeline
- Configuration for strict vs warn
- Tests/docs

### Out-of-Scope

- Generating new Zod schemas (already done)

### Deliverables

- **Est. Lines of Code:** 300-400
- **Est. Blast Radius:** host runtimes, adapters, tests, docs

## Implementation Details

### High-Level Approach

Leverage existing Zod artifacts, attach to RPC wrappers, provide configuration for failure handling, and integrate logging/evidence.

### Affected Areas

- packages/wesley-host-node RPC wrappers
- Framework adapters (Nuxt/SvelteKit/Next) as needed
- Docs on validation

### Implementation Steps

- [ ] Expose Zod validators from generator outputs.
- [ ] Integrate validators into RPC wrappers.
- [ ] Add configuration for strict/warn mode.
- [ ] Update tests and docs.

## Test Plan

### Happy Path

- [ ] Valid payloads accepted; invalid payloads rejected with clear errors.

### Edge Cases

- [ ] Large payloads, optional fields handled correctly.

### Failure Cases

- [ ] Validation warnings logged when non-strict mode used.

### Monitoring & Success Metrics

- [ ] HOLMES evidence reflects validation outcomes (optional).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | RPC pipeline | TBD | pending | |

## Requirements

### Hard Requirements

- Validation must match schema contract exactly.

### Soft Requirements

- Provide extension point for custom error handling.

### Runtime Requirements

- Minimal performance overhead.

### Dependencies & Approvals

- [ ] Coordination with generator/host maintainers.

---

## Production Notes

### Priority: 4 / 5

Strengthens data plane safety.

### Complexity: 4 / 5

Cross-cutting integration.

### Estimate: 40 - 60 hours

Includes integration, tests, docs.

### Risk & Rollback

- **Primary Risks:** False positives blocking valid requests.
- **Mitigations:** Provide configuration to relax/override.
- **Rollback / Kill Switch:** Disable validation via config if necessary.
