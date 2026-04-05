# GH-103 enhancement(holmes-cli): adopt commander for argument parsing

- Imported from: GitHub issue
- Issue: #103
- URL: https://github.com/flyingrobots/wesley/issues/103
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:22Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary
Replace the hand-rolled `process.argv` parsing in the HOLMES CLI with a robust library (e.g. Commander) to simplify future flags and subcommands.

## Motivation
Review feedback for #102 called out that our ad-hoc parser will become brittle as we keep adding commands like `weights:validate`. A library gives us automatic help output, validation, and subcommand support.

## Tasks
- Introduce Commander (or similar) to the HOLMES CLI.
- Port existing commands (`investigate`, `verify`, `predict`, `report`, `weights:validate`) to the new router.
- Ensure help output documents the new options.
- Update tests/docs if behaviours (e.g. exit codes) change.

## Acceptance Criteria
- CLI continues to support the current commands and options.
- New commands automatically show up in `--help`.
- Tests cover at least one command via the new parser.

(Relates to #102 feedback.)
