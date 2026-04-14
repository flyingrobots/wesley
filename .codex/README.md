# Codex Event Log

This directory is the repo-local fallback for agent event logging while
`codex-think` is unavailable.

## Files

- `EVENT_LOG.md`: append-only operational log for noteworthy events

## Rules

- Add new entries at the end of `EVENT_LOG.md`.
- Do not rewrite, reorder, or delete prior entries except to fix formatting in
  the same turn they were created.
- Keep entries short and factual.
- Anchor claims to commits, files, or commands when possible.
