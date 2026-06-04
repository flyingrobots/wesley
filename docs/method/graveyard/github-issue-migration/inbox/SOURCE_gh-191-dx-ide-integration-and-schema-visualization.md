# GH-191 DX: IDE Integration and Schema Visualization

- Imported from: GitHub issue
- Issue: #191
- URL: https://github.com/flyingrobots/wesley/issues/191
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:06Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: _none_

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Coordinate with DX and tooling teams for extension publishing and CLI ergonomics.

# [DX-191] DX: IDE Integration and Schema Visualization

## Overview

Enhance developer experience by creating a VS Code extension that offers Wesley directive autocomplete/docs and by adding a `wesley viz` CLI command to output an ERD-style visualization (e.g., Mermaid.js) from GraphQL schemas.

## References & Assets

- [ ] Figma / Design: TBD for UX of diagrams
- [ ] Product Spec: n/a (create as part of this work)
- [x] Related Issues / PRs: none yet
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: current CLI commands, directive definitions (`docs/DIRECTIVES.md`)

## User Story

As a **developer working with Wesley**, I want **IDE assistance and quick schema diagrams**, so that **I can design and review schemas efficiently without leaving my editor**.

## Acceptance Criteria

- [ ] VS Code extension published (preview channel acceptable) providing directive autocomplete, hover docs, and schema validation hints.
- [ ] Extension README documents installation and supported features.
- [ ] `wesley viz` CLI command generates ERD output (Mermaid or similar) and supports output to file/stdout.
- [ ] CLI command covered by automated tests/examples.

## Definition of Done

Extension available in VS Code marketplace (or internal registry), CLI command merged with docs updates, and sample schema successfully rendered.

## Scope

### In-Scope

- VS Code extension MVP (TypeScript language server integration or simple provider)
- CLI visualization command + tests

### Out-of-Scope

- Support for additional IDEs (follow-up issues)
- Advanced diagram editing UI

### Deliverables

- **Est. Lines of Code:** 1500-2000 (extension + CLI + tests)
- **Est. Blast Radius:** `packages/wesley-cli`, new `packages/wesley-vscode` (or similar)

## Implementation Details

### High-Level Approach

Use VS Code extension API with JSON/TS data of directives to serve completions/hover docs. Build `wesley viz` by reusing core IR to generate Mermaid syntax and optionally produce PNG/SVG via CLI flag.

### Affected Areas

- New VS Code extension project (`extensions/vscode-wesley` or similar)
- CLI command implementation (`packages/wesley-cli/src/commands/viz.mjs`)
- Documentation (README, docs/guides)

### Implementation Steps

- [ ] Scaffold VS Code extension repo/workspace entry.
- [ ] Implement completions and hover providers pulling directive metadata.
- [ ] Implement schema validation diagnostics (optional stretch).
- [ ] Add CLI `viz` command generating Mermaid ERD.
- [ ] Write docs/tutorial for both features.

## Test Plan

### Happy Path

- [ ] Extension completion/hover verified on sample schema.
- [ ] CLI `wesley viz` run on example schema produces valid Mermaid diagram.

### Edge Cases

- [ ] Large schema performance tested.
- [ ] Invalid directives display helpful messages.

### Failure Cases

- [ ] CLI handles missing schema file gracefully with error.

### Monitoring & Success Metrics

- [ ] Track extension installs/downloads (if published).

### QA Sign-off Matrix

| Environment    | Surface              | Owner | Status  | Notes     |
| -------------- | -------------------- | ----- | ------- | --------- |
| VS Code Stable | Extension            | TBD   | pending | Manual QA |
| CLI            | `wesley viz` command | TBD   | pending |           |

## Requirements

### Hard Requirements

- Extension must read directive metadata from canonical source to avoid drift.
- CLI output should integrate with docs/website (Mermaid markdown).

### Soft Requirements

- Provide quickstart gif/screenshot in docs.

### Runtime Requirements

- Extension targeted at VS Code 1.85+.
- CLI should work cross-platform (macOS/Linux/Windows).

### Dependencies & Approvals

- [ ] DX lead approval for extension scope.
- [ ] CLI maintainer review for new command entrypoint.

---

## Production Notes

### Priority: 3 / 5

Important DX initiative but can run in parallel with other roadmap items.

### Complexity: 4 / 5

New extension + CLI command.

### Estimate: 120 - 160 hours

Includes design, implementation, docs, and QA.

### Risk & Rollback

- **Primary Risks:** Extension maintenance burden, CLI dependency bloat.
- **Mitigations:** Keep extension lightweight; reuse existing core IR for CLI.
- **Rollback / Kill Switch:** Extension can be unpublished or flagged experimental; CLI command guarded behind feature flag if needed.
