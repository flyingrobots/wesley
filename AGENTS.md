# AGENTS.md

This file contains repository-specific instructions for autonomous and
semi-autonomous contributors working in this repo.

For product strategy and repo workflow, read:

- [README.md](README.md)
- [docs/README.md](docs/README.md)
- [docs/BEARING.md](docs/BEARING.md)
- [docs/VISION.md](docs/VISION.md)
- [ROADMAP.md](ROADMAP.md)
- [docs/method/process.md](docs/method/process.md)
- [docs/method/guide.md](docs/method/guide.md)
- [docs/method/release.md](docs/method/release.md)

## Workflow Surface

Wesley uses METHOD for repo coordination.

The repo-visible working surface is:

- `docs/method/backlog/` for queued work
- `docs/design/` for active cycle packets
- `docs/method/retro/` for closed-cycle packets
- `docs/method/retro/<cycle>/witness/` for playback and verification proof
- `docs/method/graveyard/` for rejected or retired work with context
- `docs/method/releases/` for internal release packets
- `docs/releases/` for user-facing release notes
- `docs/BEARING.md` for direction at cycle boundaries
- `docs/VISION.md` for bounded executive synthesis

`ROADMAP.md` remains the product strategy and fixed-contract document. The
filesystem, not an issue tracker, is the queue.

Wesley intentionally diverges from a pure METHOD repo in one place: the root
`README.md` stays product-facing. For workflow doctrine, treat
`docs/README.md`, `docs/method/process.md`, and `docs/method/release.md` as
the authoritative front door.

## Closeout Shape

When closing a cycle, prefer one calm filesystem shape:

- `docs/method/retro/<cycle>/<task>.md` for the retro summary
- `docs/method/retro/<cycle>/witness/README.md` for the witness index
- `docs/method/retro/<cycle>/witness/playback.md` for playback answers
- `docs/method/retro/<cycle>/witness/verification.md` for re-runnable commands

If the cycle is doc-only, text artifacts and command output are enough, but the
proof still needs to be re-runnable.

## Non-Negotiables

- Never amend commits. Make a new commit instead.
- Never use `git rebase` unless there is a rare, explicit, discussed exception.
- Never force git operations.
- Respect [`.llmignore`](.llmignore). Treat it like `.gitignore` for repo
  attention.
- Keep generated runtime state in `.wesley-cache/`. It is cache/output, not
  source code.
- If docs contradict runtime behavior, fix the docs.
- Ship surfaces such as `docs/BEARING.md`, `CHANGELOG.md`, and release notes
  must reflect merged `main` state, not branch-local optimism.
- Keep tests deterministic. Prefer fake clocks, seeded randomness, and isolated
  temp state.

## Historical Chronicle Archive

The `CHRONICLES_OF_THE_MACHINE-KIND_*.jsonl` files are historical archive, not
active workflow.

- Do not append new Chronicle entries.
- Do not treat the Chronicle as the queue, the witness surface, or the source
  of current repo truth.
- If a cycle matters, update the relevant backlog, design, retro, witness, or
  signpost files directly.
- Use `codex-think` for agent memory when useful, but keep strong claims
  anchored to repo-visible files, commands, and tests.

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
- If a backlog-worthy idea appears during work, capture it in
  `docs/method/backlog/` instead of leaving it only in chat or burying it in a
  retro.
- Do not let rejected work disappear silently. Put a note in
  `docs/method/graveyard/` when that context matters.

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
