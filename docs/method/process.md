# Process

<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley uses METHOD for repo coordination. Current execution lives in GitHub
Issues, Milestones, Projects, and labels. Repository docs preserve doctrine,
direction, and evidence.

## Rules

- The queue lives in GitHub Issues. Unscheduled intake uses `triage:*` labels;
  scheduled work uses concrete release labels such as `v0.2.0`.
- The full triage flow lives in
  [`docs/topics/contributing/triage.md`](../topics/contributing/triage.md).
- Goalposts live in GitHub Milestones named `Goalpost: ...`.
- Versioned releases live in GitHub Milestones named `Release: ...`; their
  release-gate issues link to goalpost milestones because GitHub allows one
  milestone per issue.
- The roadmap board is the
  [Wesley Roadmap Project](https://github.com/users/flyingrobots/projects/18).
- Pulling work into `docs/design/<cycle>/` is commitment.
- Design packets must name sponsor human, sponsor agent, hill, playback
  questions, accessibility posture, localization posture,
  agent-inspectability posture, and non-goals.
- Playback questions drive the tests.
- If a claimed result cannot be reproduced, it is not done.
- Drift is checked explicitly at close. Invariant preservation is part of that
  check.
- Retros and GitHub issue reconciliation happen at cycle boundaries.
- Closeout packets live in `docs/method/retro/<cycle>/` and carry a
  `witness/` directory with a witness index plus playback and verification
  artifacts.
- Rejected or retired work should be closed, labeled, or moved in GitHub with
  a clear comment explaining why it should not stay active.
- Release doctrine lives in `docs/method/release.md`; internal release packets
  live in `docs/method/releases/`; user-facing release notes live in
  `docs/releases/`.
- Ship surfaces such as `docs/BEARING.md`, `CHANGELOG.md`, and release notes
  reflect merged `main` state, not branch-local optimism.
- Retros, witnesses, and updated signposts are the repo-visible closeout
  surface. Do not rely on an append-only activity log as a substitute for
  them.
- Do not add Markdown progress trackers, backlog cards, live slice ledgers, or
  release-gate checklists to repo docs.

## Default Loop

1. Pull a GitHub Issue into `docs/design/<cycle>/` when a design packet is
   needed, assign its goalpost milestone, and add it to the Wesley Roadmap
   Project if missing.
   If the issue still has a `triage:*` label, schedule, split, move, or close it
   before implementation.
2. Write the design with both human and agent sponsors named.
3. Write failing tests from the playback questions.
4. Make the tests pass.
5. Produce a reproducible playback witness.
6. Close the cycle packet with a retro in `docs/method/retro/<cycle>/` and a
   `witness/` directory that records playback and verification evidence.
7. Reconcile GitHub Issue labels, milestone, and Project state; close, move, or
   label genuinely rejected or retired work in GitHub instead of letting stale
   repo evidence drift silently.
8. After merge, update `docs/BEARING.md`, `CHANGELOG.md`, and release notes
   when the merged state changes them.

## Closeout Surface

Wesley's repo-visible closeout surface is:

- `docs/method/retro/<cycle>/` for cycle retrospectives
- `docs/method/retro/<cycle>/witness/` for witness index, playback, and
  verification artifacts
- `docs/method/releases/` for internal release packets
- `docs/releases/` for user-facing release notes

## Repo-Specific Notes

- Wesley's product invariants live under `docs/invariants/`.
- Wesley's current legends live under `docs/method/legends/`.
- Wesley intentionally keeps the root `README.md` product-facing. For repo
  workflow doctrine, use `docs/README.md`, `docs/method/process.md`, and
  `docs/method/release.md`.
- Review visibility lives on GitHub Issues, branches, and PRs. Repository docs
  record durable evidence rather than duplicating the live tracker.
