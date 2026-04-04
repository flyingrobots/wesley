# GH-123 feat(realm): seed + masking workflow

- Imported from: GitHub issue
- Issue: #123
- URL: https://github.com/flyingrobots/wesley/issues/123
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:01Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:shadow-realm`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Work with workload replay issue (#124) to ensure seeded data supports traces.

# [REALM-123] feat(realm): seed + masking workflow

## Overview

Implement tooling to hydrate Shadow REALM with production-like data while masking PII before rehearsals.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #124 (workload replay)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing REALM scripts, directive metadata

## User Story

As a **DB operator**, I want **seed/masking automation for REALM**, so that **rehearsals run against realistic, sanitized datasets**.

## Acceptance Criteria

- [ ] Seed pipeline ingests fixtures/dumps with masking transforms derived from directives.
- [ ] CLI hooks (`wesley shadow up --seed`) and CI scripts execute pipeline.
- [ ] `.wesley/realm.json` records data freshness and masking status.
- [ ] Tests validate masking helpers on representative schemas.
- [ ] Documentation covers setup and masking strategy.

## Definition of Done

Seed/masking workflow implemented, tests passing, docs updated, REALM evidence enriched.

## Scope

### In-Scope

- Masking helper implementation using directives
- Seed pipeline integration
- CLI/CI hooks
- Evidence updates

### Out-of-Scope

- Production data extraction automation (document manual steps)

### Deliverables

- **Est. Lines of Code:** 700-900
- **Est. Blast Radius:** REALM scripts, evidence bundle, docs, tests

## Implementation Details

### High-Level Approach

Leverage directives (`@pii`, `@tenant`, etc.) to generate masking rules, create pipeline to import dumps/fixtures, integrate with REALM CLI, update evidence with metadata.

### Affected Areas

- packages/wesley-shadow
- HOLMES evidence integration
- Docs

### Implementation Steps

- [ ] Design masking rule derivation.
- [ ] Implement seed/mask pipeline with CLI hooks.
- [ ] Update evidence bundle with masking metadata.
- [ ] Add tests and documentation.

## Test Plan

### Happy Path

- [ ] Sample schema seeded with masked data successfully.

### Edge Cases

- [ ] Sensitive columns flagged; ensure masking applied.
- [ ] Non-PII data untouched.

### Failure Cases

- [ ] Masking rules missing -> warnings/errors.

### Monitoring & Success Metrics

- [ ] REALM evidence shows data freshness/masking status.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | Masking pipeline | TBD | pending | |

## Requirements

### Hard Requirements

- PII directives enforce masking automatically.

### Soft Requirements

- Provide hooks for custom masking logic.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Coordination with security/compliance stakeholders.

---

## Production Notes

### Priority: 4 / 5

Critical for realistic rehearsals.

### Complexity: 5 / 5

Masking + seeding pipeline.

### Estimate: 120 - 160 hours

Includes design, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Incomplete masking leading to sensitive data exposure.
- **Mitigations:** Comprehensive tests, allow manual overrides, document responsibilities.
- **Rollback / Kill Switch:** Provide flag to disable seeding/masking if issues found.
