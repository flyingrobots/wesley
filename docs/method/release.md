# Release

Releases happen when externally meaningful behavior changes.

## Shaped Release

A shaped release is not just a tag plus a changelog edit. It is a deliberate
packet that says what is shipping, why this version number is correct, which
users benefit, and what they need to do next.

Required release artifacts:

- `docs/method/releases/vX.Y.Z/release.md`
  Internal release design and acceptance packet. It defines:
  - included shipped cycles or externally meaningful changes
  - hills advanced by the release
  - sponsored users affected and how they are helped
  - why this exact version number is justified
  - whether migration guidance is required
- `docs/method/releases/vX.Y.Z/verification.md`
  Internal release witness. It records discovery, pre-flight validation,
  tag/publish evidence, and direct verification of delivery.
- `docs/releases/vX.Y.Z.md`
  User-facing release notes and migration guide.
- `CHANGELOG.md`
  Historical ledger of externally meaningful behavior.

`CHANGELOG.md` remains the ledger. The user-facing guided release surface lives
in `docs/releases/`.

## Scope

Releases aggregate shipped work. They do not create version-scoped filesystem
backlog directories, and implementation issues stay in goalpost milestones.
Release membership is tracked with concrete release lane labels such as
`lane:v0.2.0`; release milestones hold release-gate issues.

The release design names and justifies the intended version before tagging.
Commit history, diff inspection, and validation can support or challenge that
judgment during pre-flight, but they do not silently own the decision by
themselves.

## Default

- Not every cycle is a release.
- Every cycle still updates the living docs honestly.
- Every release still needs a user-facing explanation, not just a ledger entry.
- `README.md` should point at durable release surfaces, not accumulate
  per-version sediment.

## Sequence

1. Shape the release in `docs/method/releases/vX.Y.Z/release.md`.
2. Accept the release scope and version justification before tagging.
3. Draft the user-facing release notes in `docs/releases/vX.Y.Z.md`.
4. Run the sequential pre-flight in `docs/method/release-runbook.md`.
5. Tag, publish, and verify delivery directly.
6. Ship sync repo-level surfaces that the release changed.

## User-Facing Release Notes

These notes should be documentation, not ledger sludge. At minimum they should
answer:

- Summary
- What Changed
- Why It Matters
- Breaking Changes
- Migration
- Links to deeper docs

If no migration is required, say `No migration required.` explicitly.

## Runbook

The doctrine lives here. The command-by-command, abort-fast release procedure
lives in `docs/method/release-runbook.md` so it can become more explicit or
automated later without bloating the core doctrine.
