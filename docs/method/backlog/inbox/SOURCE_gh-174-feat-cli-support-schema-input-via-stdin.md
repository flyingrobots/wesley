# GH-174 feat(cli): support schema input via stdin

- Imported from: GitHub issue
- Issue: #174
- URL: https://github.com/flyingrobots/wesley/issues/174
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:58Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `enhancement`, `pkg:wesley-cli`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Ensure CLI help text updated to show `--schema -` usage.

# [CLI-174] feat(cli): support schema input via stdin

## Overview

Allow `wesley generate` (and related commands) to accept schema input from stdin so pipelines can pipe GraphQL SDL without writing to disk.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: connections with CLI atomic writes (#175) and pg_prove (#176)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-cli/TASKLIST.md

## User Story

As a **CI engineer**, I want **to pipe schema documents into Wesley**, so that **I can avoid creating temporary files in automation**.

## Acceptance Criteria

- [ ] CLI accepts `--schema -` or detects stdin when no `--schema` provided.
- [ ] Pipeline streams stdin into compiler with validation/error handling.
- [ ] Emitted bundle artifacts include provenance note indicating stdin origin.
- [ ] CLI help/README updated with usage example.
- [ ] Tests cover stdin scenarios.

## Definition of Done

stdin support merged, documented, tested, and backward-compatible with existing file path usage.

## Scope

### In-Scope

- CLI argument parsing updates
- Stream handling for schema input
- Tests/docs

### Out-of-Scope

- Changes to schema parsing logic itself

### Deliverables

- **Est. Lines of Code:** 200-250
- **Est. Blast Radius:** `packages/wesley-cli` command parsing, tests, docs

## Implementation Details

### High-Level Approach

Detect stdin availability, read schema into memory/stream, pass downstream; ensure asynchronous handling and fallback to file path logic when needed.

### Affected Areas

- CLI entrypoints (`generate`, `plan`, etc.)
- Bundle metadata (provenance message)
- Documentation

### Implementation Steps

- [ ] Add helper to read stdin when flagged.
- [ ] Integrate with commands that accept `--schema`.
- [ ] Update bundle metadata with provenance.
- [ ] Add tests and docs.

## Test Plan

### Happy Path

- [ ] Pipe schema via stdin; command succeeds.

### Edge Cases

- [ ] Empty stdin -> helpful error.
- [ ] Combination of stdin + file path -> deterministic behaviour (prefer CLI flag).

### Failure Cases

- [ ] Stdin errors handled gracefully (timeout, closed pipe).

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local | CLI | TBD | pending | |
| CI | CLI | TBD | pending | |

## Requirements

### Hard Requirements

- Backwards compatible with file-based inputs.

### Soft Requirements

- Provide example pipeline snippet in docs.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] CLI maintainers review implementation.

---

## Production Notes

### Priority: 4 / 5

Enhances automation workflows.

### Complexity: 3 / 5

Moderate CLI refactor.

### Estimate: 32 - 48 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Edge cases with stdin detection.
- **Mitigations:** Thorough testing, fallback to file path logic.
- **Rollback / Kill Switch:** Revert change if issues arise.
