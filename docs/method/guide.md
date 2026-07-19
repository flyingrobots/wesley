# Guide

This document holds practical advice for working in Wesley's METHOD surface.
It is lighter than doctrine in `README.md` or `docs/method/process.md`.

## Capture ideas immediately

If a work-worthy idea surfaces during the work, capture it now.

Open a GitHub Issue in one canonical scheduling state: unscheduled with exactly
one `triage:*` label and no milestone, or scheduled with one plain `vX.Y.Z`
milestone and no `triage:*` or version label. Add classification labels instead
of leaving the idea only in chat, in a dirty worktree, or buried inside a retro.

## Retro versus Issues

Do not confuse the closeout surface with the queue.

- Retros and witnesses record what was proved.
- GitHub Issues record what should happen.
- Closed or triaged GitHub Issues record what should stay rejected or retired
  with context.

If a new idea surfaces during work, prefer a GitHub Issue over burying the idea
in chat or in a retro note.

## Keep retro packets boring

Prefer one calm closeout shape per cycle:

- `docs/method/retro/<cycle>/<task>.md` for the retro summary
- `docs/method/retro/<cycle>/witness/README.md` for the witness index
- `docs/method/retro/<cycle>/witness/playback.md` for playback answers
- `docs/method/retro/<cycle>/witness/verification.md` for re-runnable commands

If the cycle is doc-only, the witness can be text-first. A screenshot or one-off
observation may support the proof, but it should not carry the done-claim alone.

## Keep signposts calm

`docs/BEARING.md` and `docs/VISION.md` should stay bounded. They summarize the
state of the repo. They do not replace designs, retros, witnesses, or the
roadmap.

## Wesley's README divergence

Generic METHOD repos treat `README.md` as the operating doctrine front door.
Wesley intentionally keeps the root `README.md` product-facing for now.

Treat `docs/README.md`, `docs/method/process.md`, and `docs/method/release.md`
as the authoritative workflow surface when there is any doubt about cycle or
closeout mechanics.

## Split release surfaces on purpose

Do not collapse release work into one note.

- `docs/method/releases/` is for internal release packets and verification.
- `docs/releases/` is for user-facing release notes and migration guidance.
- `CHANGELOG.md` remains the historical ledger.

## Prefer legend-labeled issues

Use `legend:SOURCE` for schema semantics, directive truth, parser/IR meaning,
and ops-contract work.
Use `legend:TRANSMUTE` for generator, transmutation, and output-domain work.
Use `legend:RUNTIME` for run-model and operator-flow work.
Use `legend:EVIDENCE` for evidence-map, Holmes-family, and certification work.

If the work does not fit a legend cleanly, name it plainly instead of forcing a
bad label.
