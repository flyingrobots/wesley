# GH-161 chore(parser): reduce directive validation noise

- Imported from: GitHub issue
- Issue: #161
- URL: https://github.com/flyingrobots/wesley/issues/161
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:14Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `chore`, `pkg:wesley-host-node`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Coordinate with docs to ensure warnings reference new guidance.

# [PARSER-161] chore(parser): reduce directive validation noise

## Overview

Adjust the GraphQL adapter validation so directives like `@uid`/`@weight` and root type warnings don’t spam every compile while still flagging real errors.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: none
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: TASKLIST items in host-node/parser

## User Story

As a **developer compiling schemas**, I want **validation warnings to highlight actionable issues only**, so that **I’m not overwhelmed by noise from valid directives**.

## Acceptance Criteria

- [ ] Validation logic recognizes canonical directives (e.g., `@uid`, `@weight`) without warning spam.
- [ ] Root type warnings appear only when missing/incorrect, not every compile.
- [ ] Legitimate errors continue to be surfaced.
- [ ] Tests cover updated warning behaviour.

## Definition of Done

Noise reduced, meaningful warnings intact, tests updated, documentation adjusted if necessary.

## Scope

### In-Scope

- Parser validation adjustments
- Tests for warnings

### Out-of-Scope

- New directives or validation features beyond noise reduction

### Deliverables

- **Est. Lines of Code:** 150-250
- **Est. Blast Radius:** parser validation code, tests

## Implementation Details

### High-Level Approach

Update validation rules to whitelist known directives, consolidate warning output, and ensure root type checks run conditionally.

### Affected Areas

- packages/wesley-host-node parser/validation modules
- Tests verifying warnings

### Implementation Steps

- [ ] Audit current warnings produced.
- [ ] Adjust validation to whitelist canonical directives.
- [ ] Update root type warnings to be context-aware.
- [ ] Write tests ensuring noise removed but errors still detected.

## Test Plan

### Happy Path

- [ ] Schema with canonical directives compiles without extra warnings.

### Edge Cases

- [ ] Missing root type still warns.
- [ ] Unknown directive continues to error/warn appropriately.

### Failure Cases

- [ ] Ensure no warnings suppressed unintentionally.

### Monitoring & Success Metrics

- [ ] Optional logging of warning counts in tests.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Parser validation | TBD | pending | |

## Requirements

### Hard Requirements

- Maintain error detection capability.

### Soft Requirements

- Provide doc note referencing new behaviour.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Parser maintainers review change.

---

## Production Notes

### Priority: 3 / 5

Improves developer experience.

### Complexity: 3 / 5

Requires careful validation adjustments.

### Estimate: 24 - 32 hours

Includes implementation and tests.

### Risk & Rollback

- **Primary Risks:** Suppressing legitimate warnings.
- **Mitigations:** Comprehensive tests.
- **Rollback / Kill Switch:** Revert validation change if issues appear.
