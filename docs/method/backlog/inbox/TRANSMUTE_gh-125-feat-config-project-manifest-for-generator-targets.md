# GH-125 feat(config): project manifest for generator targets

- Imported from: GitHub issue
- Issue: #125
- URL: https://github.com/flyingrobots/wesley/issues/125
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:45Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:config-orchestration`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Foundation for env generation (#127) and docker scaffolding (#126).

# [CONFIG-125] feat(config): project manifest for generator targets

## Overview

Introduce a `wesley.config` manifest declaring generation targets, rehearsal settings, and integrations so CLI commands auto-discover configuration.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #127 (env), #126 (docker), #128 (init)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing CLI defaults, docs

## User Story

As a **team adopting Wesley**, I want **a config manifest that defines targets**, so that **running CLI commands in the project automatically emits the right artifacts**.

## Acceptance Criteria

- [ ] Manifest schema defined (YAML/JSON) covering generators, REALM options, Supabase extras, CLI defaults.
- [ ] `wesley transform/plan/rehearse` honor manifest defaults when run without explicit flags.
- [ ] Schema validation with helpful errors for missing/invalid config.
- [ ] Examples updated to include config file.
- [ ] Docs explain manifest structure, precedence with CLI flags, and migration guidance.

## Definition of Done

Manifest support merged, tests passing, docs updated, examples using manifest, CLI autodiscovery functional.

## Scope

### In-Scope

- Config schema implementation
- CLI integration for autodiscovery
- Documentation and examples

### Out-of-Scope

- Env/docker generation (follow-up issues)

### Deliverables

- **Est. Lines of Code:** 600-800
- **Est. Blast Radius:** Config module, CLI commands, docs, examples

## Implementation Details

### High-Level Approach

Define schema (zod or similar), implement loader that searches for `wesley.config.*`, merge with CLI flags, validate, integrate with CLI commands, update docs/examples.

### Affected Areas

- Config loader module
- CLI command entrypoints
- Docs/examples

### Implementation Steps

- [ ] Design schema and defaults.
- [ ] Implement manifest loader + validation.
- [ ] Integrate with CLI commands (transform/plan/rehearse).
- [ ] Update examples and docs.
- [ ] Add tests.

## Test Plan

### Happy Path

- [ ] CLI commands read manifest and emit correct artifacts.

### Edge Cases

- [ ] Missing manifest -> fallback with warning.
- [ ] Invalid options -> error with guidance.

### Failure Cases

- [ ] Conflicting CLI flags vs manifest resolved deterministically.

### Monitoring & Success Metrics

- [ ] Optional telemetry (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Config loader | TBD | pending | |
| Integration | CLI commands | TBD | pending | |

## Requirements

### Hard Requirements

- Backward compatible CLI behaviour.

### Soft Requirements

- Provide schema docs and examples.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] CLI maintainers review design.

---

## Production Notes

### Priority: 5 / 5

Foundation for config-driven automation.

### Complexity: 5 / 5

Cross-cutting configuration system.

### Estimate: 120 - 160 hours

Includes design, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Misconfiguration causing unexpected outputs.
- **Mitigations:** Strong validation, clear precedence rules.
- **Rollback / Kill Switch:** Provide flag to disable manifest discovery temporarily.
