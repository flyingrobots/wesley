# GH-185 feat(core): finish RPC directive & generator pipeline

- Imported from: GitHub issue
- Issue: #185
- URL: https://github.com/flyingrobots/wesley/issues/185
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:05Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `feature`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: manual override: RPC directive-to-generator pipeline is chiefly a transmutation path.

## Original Issue

---

## Additional Notes

Consolidated on 2025-10-23: generator coverage work from former #182 now lives here. Use the combined checklist to track directive parsing through SQL emission.

# [CORE-185] feat(core): finish RPC directive & generator pipeline

## Overview

Complete the RPC directive pipeline end-to-end so that `@rpc`, `@function`, and `@grant` directives parse correctly, propagate metadata through the IR, and produce generator outputs that cover qualified names, built-ins, and variadic arguments without manual tweaks.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #181 (pipeline tests), docs updates TBD
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-core/TASKLIST.md, packages/wesley-generator-supabase

## User Story

As a **developer using Wesley's RPC pipeline**, I want **directives and generators to work end-to-end**, so that **custom operations generate correct SQL without manual intervention**.

## Acceptance Criteria

- [ ] RPC directives registered in GraphQL adapter and canonical registry (alias support included).
- [ ] Directive arguments (including strings/defaults) parsed and surfaced in IR without relying on naming heuristics.
- [ ] IR exposes metadata required for generator coverage (qualified names, built-ins, variadic args, grants).
- [ ] Generated functions emit valid SQL for schema-qualified names, built-in references, and variadic parameters with tests.
- [ ] Documentation reflects directive usage and generator capabilities.

## Delivery Checklist

1. **Directive & Parser Work**
   - [ ] Register directives and validate schema parsing (legacy TODOs cleared).
   - [ ] Update validation/evidence warnings for missing directive args.
2. **IR & Metadata Flow**
   - [ ] Extend IR types to carry RPC metadata (operation mode, grant info, argument configuration).
   - [ ] Remove naming heuristics; add explicit operation wiring.
3. **Generator Enhancements**
   - [ ] Support schema-qualified function names.
   - [ ] Handle built-in Postgres functions without misclassification.
   - [ ] Emit variadic argument SQL signatures and default handling.
   - [ ] Ensure backwards compatibility for existing generated SQL (snapshot tests updated).
4. **Testing & Docs**
   - [ ] Add integration tests covering schema → SQL pipeline.
   - [ ] Document supported directive syntax and generator options (docs/guides + TASKLIST update).

## Definition of Done

RPC directives and generator enhancements merged, automated tests green, documentation updated, and TASKLIST entries cleared.

## Scope

### In-Scope

- Parser updates for directives
- IR enhancements to carry RPC metadata
- SQL generator improvements for coverage scenarios
- Tests and documentation

### Out-of-Scope

- New RPC features beyond existing directives (follow-up work)

### Deliverables

- **Est. Lines of Code:** 600-800
- **Est. Blast Radius:** `packages/wesley-core`, `packages/wesley-generator-*`, tests

## Implementation Details

### High-Level Approach

Register directives in parser, adjust IR to store RPC metadata, update generator to consume metadata instead of heuristics, and add integration tests ensuring qualified/built-in/variadic coverage.

### Affected Areas

- packages/wesley-core (parser, IR)
- packages/wesley-generator-supabase (SQL generator)
- tests/integration (new cases)
- docs/guides/rpc.md (or similar)

### Implementation Steps

- [ ] Register directives and ensure alias support.
- [ ] Extend IR types and update pipeline wiring.
- [ ] Update generator to use metadata for qualified/built-in/variadic coverage.
- [ ] Write integration/unit tests to protect behaviour.
- [ ] Update documentation/TASKLIST entries.

## Test Plan

### Happy Path

- [ ] Schema with RPC directives generates expected SQL and grants in tests.

### Edge Cases

- [ ] Directives with optional/complex arguments handled correctly.
- [ ] Variadic + default parameters supported simultaneously.

### Failure Cases

- [ ] Missing directives produce actionable errors.

### Monitoring & Success Metrics

- [ ] n/a (library feature).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/Integration tests | RPC pipeline | TBD | pending | |

## Requirements

### Hard Requirements

- Remove reliance on naming heuristics for RPC detection.
- Maintain backward compatibility with existing schemas.

### Soft Requirements

- Provide documentation snippet or generator README updates.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Coordinate with generator owners and DX for documentation.

---

## Production Notes

### Priority: 4 / 5

Key step toward production-ready RPC pipeline.

### Complexity: 4 / 5

Touches parser, IR, and generators.

### Estimate: 60 - 80 hours

Includes implementation and integration tests.

### Risk & Rollback

- **Primary Risks:** Regression in existing generator output.
- **Mitigations:** Add regression tests, gate behind feature flag if needed.
- **Rollback / Kill Switch:** Ability to revert to heuristic path temporarily.
