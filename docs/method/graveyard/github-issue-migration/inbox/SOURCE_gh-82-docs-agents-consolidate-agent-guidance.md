# GH-82 docs(agents): consolidate agent guidance

- Imported from: GitHub issue
- Issue: #82
- URL: https://github.com/flyingrobots/wesley/issues/82
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:10Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `chore`, `docs`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

The repository currently has three files with guidance for AI agents: `AGENTS.md`, `CLAUDE.md`, and `CODEX.md`. This is redundant and confusing. This task is to consolidate all agent guidance into `AGENTS.md` as the single source of truth. The valuable historical information from `CLAUDE.md` and `CODEX.md` should be archived (e.g., into `docs/archive/agent-history.md`), and then the original files should be deleted.
