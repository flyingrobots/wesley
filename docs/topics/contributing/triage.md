# Issue Triage

<!-- docs-truth: status=current owner=@flyingrobots -->

Triage turns unscheduled intake into a named future release, a split issue, a
repo move, or a closure. Classification can help the discussion, but the
decision that matters is whether the work is unscheduled or assigned to one
release.

## Scheduling Model

Use exactly one of these mutually exclusive scheduling states:

| State       | Canonical GitHub Metadata                                                |
| ----------- | ------------------------------------------------------------------------ |
| Unscheduled | Exactly one `triage:*` label and no milestone.                           |
| Scheduled   | Exactly one plain `vX.Y.Z` milestone and no `triage:*` or version label. |

Plain version milestones are the sole authority for scheduled release scope.
Labels classify work; they do not duplicate a scheduled issue's release.
`vX.Y.Z` denotes exact tag-form SemVer; every prerelease uses its full title,
such as `v0.3.0-alpha.2`.

Current triage labels:

| Label               | Meaning                         |
| ------------------- | ------------------------------- |
| `triage:requests`   | Raw requests and incoming asks. |
| `triage:bad-code`   | Debt intake.                    |
| `triage:cool-ideas` | Exploratory idea intake.        |

Do not create version labels or generic `lane:*` labels. In particular, do not use
`lane:asap`, `lane:inbox`, `lane:bad-code`, `lane:cool-ideas`,
`lane:release`, or `lane:planned` for active work.

## Invariants

Every open issue must be either unscheduled or scheduled:

- Unscheduled: exactly one `triage:*` label and no milestone.
- Scheduled: exactly one plain `vX.Y.Z` milestone and no `triage:*` label.

Scheduled issues also must not carry a concrete version label.

An open issue must never carry both scheduling states, multiple release
milestones, a non-version milestone, or a version label. Narrative release
outcomes may group scope in release planning and gate issues, but they are not
additional milestones.

## Triage Flow

For each issue in `triage:requests`, `triage:bad-code`, or
`triage:cool-ideas`:

1. Decide whether it is valid Wesley work.
2. If it is invalid, close it or move it to the owning repo.
3. If it is valid but too broad, split it before scheduling.
4. If it fits an existing named release, remove `triage:*` and assign the plain
   `vX.Y.Z` milestone.
5. If it needs a future release that does not exist yet, propose the release
   and create its milestone only after the release has a clear purpose.
6. Leave it under `triage:*` only when the scheduling decision is genuinely not
   ready.

## Creating A Future Release Milestone

Create one plain `vX.Y.Z` milestone only when the proposed release has:

- a clear release purpose,
- a coherent batch of issues and narrative outcomes,
- an ordering argument relative to existing releases,
- a release-gate issue in that milestone.

The release-gate issue should link the scheduled work by milestone query and
name the narrative release outcomes that organize the scope. Do not create
`Goalpost: ...` or `Release: ...` milestones; outcomes are narrative groups
inside the plain version milestone.

## Topic Labels

Topic labels are useful, but they are not scheduling labels.

Use `legend:*`, `group:*`, `pkg:*`, `work:*`, `priority:*`, and ordinary
work-type labels (`bug`, `feature`, `chore`, `docs`, `tests`, `ci`) to explain
what kind of work an issue represents. Only `triage:*` marks unscheduled
intake; scheduled release scope comes from the issue's plain version milestone.

## One-Time Live Cutover

The governance change that establishes this model and the live GitHub metadata
must cross one controlled boundary. Merge the approved governance pull request
before any live tracker mutation. The merged doctrine, templates, release
profile, and guards are the authority for the cutover.

Immediately after that merge, and before any other planning or release write:

1. Freeze issue scheduling, milestone edits, release-gate closure, and tag
   creation for the duration of the cutover.
2. Capture the complete open-issue and milestone state with paginated,
   reproducible queries:

   ```bash
   gh api --hostname github.com --paginate 'repos/flyingrobots/wesley/issues?state=open&per_page=100' \
     --jq '.[] | select(.pull_request == null) | {number, labels: [.labels[].name], milestone: .milestone.title}'
   gh api --hostname github.com --paginate 'repos/flyingrobots/wesley/milestones?state=all&per_page=100' \
     --jq '.[] | {number, title, state, open_issues, closed_issues}'
   ```

3. Review and record the complete old-to-new issue mapping in the migration
   issue or pull request before changing live metadata.
4. For an active `Release: vX.Y.Z` milestone with zero closed issue
   associations and no colliding exact milestone, rename it to exactly
   `vX.Y.Z`. If it has any closed association or the exact milestone already
   exists, preserve the legacy milestone title, create or reuse the exact
   milestone, move only its open issues and active gate, and then close the
   emptied legacy milestone.
5. Move every open scheduled issue—including each release gate—from active
   `Goalpost: ...` milestones into its reviewed exact version milestone. Never
   move the closed issues that remain historical evidence in those milestones.
6. Remove `triage:*` and concrete-version labels from scheduled issues. Leave
   unscheduled issues with exactly one `triage:*` label and no milestone.
7. After they contain no open issues, close the retired active narrative and
   prefixed release milestones. Do not rename, delete, reopen, or rewrite closed
   historical milestones or their issue associations.
8. Repeat the two snapshot queries and verify every open issue satisfies
   exactly one scheduling state, every gate shares its exact version milestone,
   and no retired scheduling label remains assigned to an open issue.
9. Lift the freeze only while that verification is clean. If any mutation or
   verification fails, stop, leave the merged enforcement intact, record the
   failure in the migration issue, and keep the release freeze in place until
   the live metadata is repaired and reverified. Do not restore a partial
   version of the retired scheduling model.

Retired label definitions may remain for historical search, but after cutover
they are never assigned to open issues.

### Legacy Mapping

Replace old generic lane and version labels as follows:

| Old label         | Replacement                                               |
| ----------------- | --------------------------------------------------------- |
| `lane:inbox`      | `triage:requests` with no milestone.                      |
| `lane:bad-code`   | `triage:bad-code` with no milestone until scheduled.      |
| `lane:cool-ideas` | `triage:cool-ideas` with no milestone until scheduled.    |
| `lane:release`    | The selected plain `vX.Y.Z` milestone.                    |
| `lane:asap`       | A plain `vX.Y.Z` milestone, or close/split.               |
| `lane:planned`    | A plain `vX.Y.Z` milestone, or unscheduled triage intake. |
| `vX.Y.Z` label    | The matching plain `vX.Y.Z` milestone; remove the label.  |

Release checks query concrete plain `vX.Y.Z` milestones. Retired lane and
version labels are historical vocabulary only; they are not release gates.

## Related Authority

- [`docs/governance/labels.md`](../../governance/labels.md) defines the
  repository label taxonomy.
- [`docs/governance/RELEASE_POLICY.md`](../../governance/RELEASE_POLICY.md)
  defines release gates and version-milestone behavior.
- [`docs/governance/RELEASE_CHECKLIST.md`](../../governance/RELEASE_CHECKLIST.md)
  defines the human release sign-off items.
