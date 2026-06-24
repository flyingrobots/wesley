# Process

<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley uses METHOD for repo coordination. Current execution lives in GitHub
Issues, Milestones, Projects, and labels. Repository docs preserve doctrine,
direction, and evidence.

## Rules

- The queue lives in GitHub Issues, organized by Method labels such as
  `lane:asap`, `lane:bad-code`, `lane:cool-ideas`, and `lane:inbox`.
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
- Do not add Markdown progress trackers, backlog cards, live slice ledgers, or
  release-gate checklists to repo docs.

## Default Loop

1. Pull a GitHub Issue into `docs/design/<cycle>/` when a design packet is
   needed, assign its goalpost milestone, and add it to the Wesley Roadmap
   Project if missing.
2. Write the design with both human and agent sponsors named.
3. Write failing tests from the playback questions.
4. Make the tests pass.
5. Produce a reproducible playback witness.
6. Close the cycle packet with a retro in `docs/method/retro/<cycle>/` and a
   `witness/` directory that records playback and verification evidence.
7. Reconcile GitHub Issue labels, milestone, and Project state; move genuinely
   rejected or retired
   repo evidence into `docs/method/graveyard/` instead of letting it drift
   silently.
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
- Review visibility lives on GitHub Issues, branches, and PRs. Repository docs
  record durable evidence rather than duplicating the live tracker.
