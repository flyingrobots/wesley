# GH-165 chore(repo): verify package exports across workspaces

- Imported from: GitHub issue
- Issue: #165
- URL: https://github.com/flyingrobots/wesley/issues/165
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:33Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `chore`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Capture findings in a shared spreadsheet or doc for future reference.

# [REPO-165] chore(repo): verify package exports across workspaces

## Overview

Audit each workspace `package.json` export map to ensure consumers and the CLI resolve entrypoints correctly before wider adoption.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: none
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: TASKLIST notes in repo root

## User Story

As a **package consumer**, I want **export maps configured correctly**, so that **imports resolve without needing deep path hacks**.

## Acceptance Criteria

- [ ] Every workspace `package.json` exports map reviewed and validated.
- [ ] CLI and library consumers can import documented entrypoints without resolution errors.
- [ ] Findings documented (fixes applied or follow-up issues created).

## Definition of Done

Audit completed, necessary corrections merged, and documentation updated if exports change.

## Scope

### In-Scope

- Reviewing and adjusting export maps
- Documenting results

### Out-of-Scope

- Major refactors of package structure

### Deliverables

- **Est. Lines of Code:** 50-150 (package.json updates)
- **Est. Blast Radius:** multiple package.json files, docs

## Implementation Details

### High-Level Approach

Iterate through each workspace, verify `exports` map against actual entrypoints, update as needed, and run smoke tests (CLI + library usage).

### Affected Areas

- package manifests
- Build/test scripts if entrypoints adjusted

### Implementation Steps

- [ ] Inventory current export maps and expected usage.
- [ ] Update maps where mismatched entries found.
- [ ] Run build/test to ensure compatibility.
- [ ] Document results and open follow-ups if needed.

## Test Plan

### Happy Path

- [ ] Import test per package using documented entrypoints succeeds.

### Edge Cases

- [ ] CLI entrypoints continue to work via Node resolution.

### Failure Cases

- [ ] Imports fail -> fix export map or add follow-up issue.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface  | Owner | Status  | Notes |
| ----------- | -------- | ----- | ------- | ----- |
| Local build | Packages | TBD   | pending |       |

## Requirements

### Hard Requirements

- Maintain backward compatibility.

### Soft Requirements

- Document any intentional deep import allowances.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Package owners review changes.

---

## Production Notes

### Priority: 3 / 5

Prevents runtime import issues.

### Complexity: 2 / 5

Mostly manifest edits + verification.

### Estimate: 24 - 32 hours

Includes audit and fixes.

### Risk & Rollback

- **Primary Risks:** Breaking consumers if exports changed incorrectly.
- **Mitigations:** Add smoke tests and coordinate with downstreams.
- **Rollback / Kill Switch:** Revert package.json updates if regressions found.
