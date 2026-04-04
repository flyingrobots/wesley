# Process
<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley uses METHOD for repo coordination. Product strategy still lives in
`ROADMAP.md`; METHOD governs how work is queued, pulled, proved, and closed.

## Rules

- The queue lives in `docs/method/backlog/`.
- Pulling work into `docs/design/<cycle>/` is commitment.
- Design packets must name sponsor human, sponsor agent, hill, playback
  questions, accessibility posture, localization posture,
  agent-inspectability posture, and non-goals.
- Playback questions drive the tests.
- If a claimed result cannot be reproduced, it is not done.
- Retros and backlog reconciliation happen at cycle boundaries.
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
6. Close the cycle packet with a retro in `docs/method/retro/<cycle>/`.
7. Reconcile backlog lanes.
8. After merge, update `docs/BEARING.md`, `CHANGELOG.md`, and release notes when
   the merged state changes them.

## Repo-Specific Notes

- Wesley's product invariants live under `docs/invariants/`.
- Wesley's current legends live under `docs/method/legends/`.
- Review visibility still lives on branches and PRs. METHOD does not pretend
  review state is native repo truth yet.
