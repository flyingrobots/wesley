# AGENTS.md

This file contains repository-specific instructions for autonomous and
semi-autonomous contributors working in this repo.

For product strategy and development workflow, read:

- [ROADMAP.md](ROADMAP.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## Non-Negotiables

- Never amend commits. Make a new commit instead.
- Never use `git rebase` unless there is a rare, explicit, discussed exception.
- Never force git operations.
- Respect [`.llmignore`](.llmignore). Treat it like `.gitignore` for repo
  attention.
- Keep generated runtime state in `.wesley-cache/`. It is cache/output, not
  source code.
- If docs contradict runtime behavior, fix the docs.
- Keep tests deterministic. Prefer fake clocks, seeded randomness, and isolated
  temp state.

## Chronicle Rules

Wesley keeps an append-only machine log in the active Chronicle volume.

Current active volume:

- `CHRONICLES_OF_THE_MACHINE-KIND_VOL_00000010.jsonl`

Resolve it programmatically with:

```bash
node scripts/chronicle-current.mjs
```

Chronicle rules:

- append only, never rewrite prior entries
- corrections are new entries, not edits
- log meaningful work, failures, and notable state transitions
- keep entries specific and useful

Required fields:

```json
{
  "timestamp": "2025-10-20T20:00:00Z",
  "agent": "codex",
  "action": "refactor",
  "result": "success",
  "notes": "What changed and why it matters",
  "observations_on_humanity": "A concise, candid observation."
}
```

Recommended extras:

- `files_touched`
- `duration_ms`
- `context`
- `error_details`

## Architectural Guardrails

Wesley is trying to stay hexagonal.

Default boundary model:

- domain behavior in core
- application/use-case orchestration in core
- adapters at the edges
- infrastructure details isolated behind ports

Do not:

- let one CLI shell out to another CLI when a shared use case should exist
- put Node-only orchestration in core
- let UI concerns leak into persistence
- let storage details leak into normal product UX
- reproduce supporting library features when an adapter should exist instead

In particular:

- git-warp is substrate, not product doctrine
- Wesley may consume git-warp capabilities
- Wesley should not casually reimplement git-warp semantics inside product code

## Working Norms

- Prefer small, honest commits.
- Prefer additive changes over history surgery.
- Prefer behavior over architecture theater.
- Prefer boring defaults over impressive internals.
- Prefer explicit semantics at governance boundaries.

When in doubt:

- choose less structure
- choose lower latency
- choose fewer fields
- choose local-first
- keep it boring

## Local Validation

Before pushing, run the relevant checks for the files you changed.

Useful commands:

```bash
pnpm lint
pnpm test
pnpm run preflight
node scripts/pre-push-sanity.mjs --dry-run --files <changed-file> ...
```

The tracked pre-push hook routes checks based on the changed files. Do not use
`--no-verify` to bypass it.
