# Process
<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley uses METHOD for repo coordination. Current execution lives in METHOD
surfaces, `docs/BEARING.md`, and active design packets.

## Rules

- The queue lives in `docs/method/backlog/`.
- Pulling work into `docs/design/<cycle>/` is commitment.
- Design packets must name sponsor human, sponsor agent, hill, playback
  questions, accessibility posture, localization posture,
  agent-inspectability posture, and non-goals.
- Playback questions drive the tests.
- If a claimed result cannot be reproduced, it is not done.
- Drift is checked explicitly at close. Invariant preservation is part of that
  check.
- Retros and backlog reconciliation happen at cycle boundaries.
- Closeout packets live in `docs/method/retro/<cycle>/` and carry a
  `witness/` directory with a witness index plus playback and verification
  artifacts.
- Rejected or retired work belongs in `docs/method/graveyard/` with a short
  note explaining why it is there.
- Release doctrine lives in `docs/method/release.md`; internal release packets
  live in `docs/method/releases/`; user-facing release notes live in
  `docs/releases/`.
- Ship surfaces such as `docs/BEARING.md`, `CHANGELOG.md`, and release notes
  reflect merged `main` state, not branch-local optimism.
- Retros, witnesses, and updated signposts are the repo-visible closeout
  surface. Do not rely on an append-only activity log as a substitute for
  them.

## Default Loop

1. Pull an item from `docs/method/backlog/` into `docs/design/<cycle>/`.
2. Write the design with both human and agent sponsors named.
3. Write failing tests from the playback questions.
4. Make the tests pass.
5. Produce a reproducible playback witness.
6. Close the cycle packet with a retro in `docs/method/retro/<cycle>/` and a
   `witness/` directory that records playback and verification evidence.
7. Reconcile backlog lanes and move genuinely rejected or retired work into
   `docs/method/graveyard/` instead of letting it drift silently.
8. After merge, update `docs/BEARING.md`, `CHANGELOG.md`, and release notes
   when the merged state changes them.

## Closeout Surface

Wesley's repo-visible closeout surface is:

- `docs/method/retro/<cycle>/` for cycle retrospectives
- `docs/method/retro/<cycle>/witness/` for witness index, playback, and
  verification artifacts
- `docs/method/graveyard/` for rejected or retired work that should not be
  re-proposed without context
- `docs/method/releases/` for internal release packets
- `docs/releases/` for user-facing release notes

## Repo-Specific Notes

- Wesley's product invariants live under `docs/invariants/`.
- Wesley's current legends live under `docs/method/legends/`.
- Wesley intentionally keeps the root `README.md` product-facing. For repo
  workflow doctrine, use `docs/README.md`, `docs/method/process.md`, and
  `docs/method/release.md`.
- Review visibility still lives on branches and PRs. METHOD does not pretend
  review state is native repo truth yet.
