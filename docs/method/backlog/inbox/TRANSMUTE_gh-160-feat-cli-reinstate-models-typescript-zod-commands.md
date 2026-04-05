# GH-160 feat(cli): reinstate models/typescript/zod commands

- Imported from: GitHub issue
- Issue: #160
- URL: https://github.com/flyingrobots/wesley/issues/160
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:56Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `feature`, `tests`, `pkg:wesley-cli`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with generator packages to ensure exports stable.

# [CLI-160] feat(cli): reinstate models/typescript/zod commands

## Overview

Restore CLI subcommands for models, TypeScript, and Zod generation using the new runtime emitters and resurrect associated tests.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: generator updates (#182, #181)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: TASKLIST item for CLI emitters

## User Story

As a **developer**, I want **CLI commands to generate models/TypeScript/Zod**, so that **I can produce typed artefacts without manual scripts**.

## Acceptance Criteria

- [ ] `wesley generate models`, `wesley generate typescript`, `wesley generate zod` (or equivalent) restored using new emitters.
- [ ] Commands integrate with existing config/flags.
- [ ] Tests cover command execution and output.
- [ ] Documentation updated with usage instructions.

## Definition of Done

Commands functional, tests passing, docs updated, and old TODO resolved.

## Scope

### In-Scope

- CLI command wiring
- Integration with generator packages
- Tests/docs

### Out-of-Scope

- New generator features beyond CLI integration

### Deliverables

- **Est. Lines of Code:** 400-600
- **Est. Blast Radius:** CLI commands, generator integration, tests

## Implementation Details

### High-Level Approach

Wire CLI commands to call new generator APIs, ensure config flags propagate, update output directories, and revive tests.

### Affected Areas

- packages/wesley-cli/command definitions
- generator packages invocation
- docs/CLI usage

### Implementation Steps

- [ ] Reintroduce commands referencing new emitters.
- [ ] Update CLI options and help.
- [ ] Add tests verifying command output.
- [ ] Update docs/README.

## Test Plan

### Happy Path

- [ ] Each command generates expected artefacts in fixtures.

### Edge Cases

- [ ] Invalid schema -> commands fail gracefully.

### Failure Cases

- [ ] Missing output directories handled.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | CLI commands | TBD | pending | |

## Requirements

### Hard Requirements

- Maintain compatibility with config options.

### Soft Requirements

- Provide examples in docs.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Generator maintainers review integration.

---

## Production Notes

### Priority: 4 / 5

Restores key CLI functionality.

### Complexity: 4 / 5

Multiple command integrations + tests.

### Estimate: 60 - 80 hours

Includes wiring, tests, docs.

### Risk & Rollback

- **Primary Risks:** Command outputs drift from generator expectations.
- **Mitigations:** Add regression tests.
- **Rollback / Kill Switch:** Temporarily hide commands behind experimental flag.
