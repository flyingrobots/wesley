# Issue & PR Labels

<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley uses a small, well-documented label set so contributors can quickly find
work and maintainers can triage effectively. All labels are applied directly on
GitHub and can be reviewed with `gh label list`.

| Label                          | Purpose                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `bug`                          | Reproducible product bug that needs a fix.                                                                      |
| `feature` / `enhancement`      | User-facing functionality requests. `feature` is used for roadmap work, `enhancement` for smaller improvements. |
| `chore`                        | Internal maintenance (refactors, dependency bumps, repo hygiene).                                               |
| `docs` / `documentation`       | Documentation work (README, guides, docs site).                                                                 |
| `tests`                        | Test coverage or flakiness fixes.                                                                               |
| `security`                     | Security or compliance related tasks.                                                                           |
| `ci`                           | Changes to automation or workflows.                                                                             |
| `rfc`                          | Exploratory proposals that require design discussion.                                                           |
| `blocked` / `needs-discussion` | Work waiting on a decision or external dependency.                                                              |
| `good first issue`             | Curated onboarding tasks for newcomers.                                                                         |
| `help wanted`                  | We actively need contributions for this issue.                                                                  |
| `holmes`, `scoring`            | Work specific to the HOLMES evidence stack.                                                                     |
| `status: non-blocking`         | Nice-to-have items that are not release blockers.                                                               |
| `pkg:*`                        | Ownership hints for the affected package(s).                                                                    |
| `triage:*`                     | Unscheduled intake classification.                                                                              |
| `legend:*`                     | Wesley legend classification.                                                                                   |
| `work:*`                       | Product, integrity, or enabler work shape.                                                                      |

## Triage And Release Scheduling

See [Issue Triage](../topics/contributing/triage.md) for the full scheduling
flow.

| Label               | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `triage:requests`   | Raw requests and incoming asks.                           |
| `triage:bad-code`   | Debt intake awaiting scheduling, split, move, or closure. |
| `triage:cool-ideas` | Idea intake awaiting scheduling, split, move, or closure. |

Every open issue must be in exactly one scheduling state:

- unscheduled with exactly one `triage:*` label and no milestone; or
- scheduled in exactly one plain `vX.Y.Z` milestone with no `triage:*` or
  concrete-version scheduling label.

Milestones are the sole named-release schedule. Labels classify only. Concrete
`vX.Y.Z` scheduling labels and generic labels such as `lane:asap`,
`lane:inbox`, `lane:bad-code`, `lane:cool-ideas`, `lane:release`, and
`lane:planned` are retired and must not be used for active work. Every issue
committed to a release shares its plain version milestone; the release gate is
the final pre-tag issue in that milestone. Release outcomes are narrative
groupings, not alternate schedules.

## Legends

Legend labels preserve Wesley's work taxonomy:

- `legend:SOURCE`
- `legend:TRANSMUTE`
- `legend:RUNTIME`
- `legend:EVIDENCE`
- `legend:SPEC`
- `legend:BLADE`
- `legend:DX`
- `legend:DOCS`
- `legend:PLATFORM`
- `legend:PROCESS`

## Label conventions

- Every newly opened issue should get **one work-type label** (bug/feature/chore/docs/tests).
- Keep new unscheduled intake in exactly one `triage:*` classification and no
  milestone.
- Schedule work by assigning exactly one plain `vX.Y.Z` milestone and removing
  every triage or concrete-version scheduling label.
- Keep the release-gate issue in that same milestone and close it last before
  tagging.
- Use **module labels** (`pkg:*`) when the work sits in a single package; skip
  them for cross-cutting features.
- Add `good first issue` only if the description already includes clear steps
  and the acceptance criteria can be completed without repo-wide context.
- `status: non-blocking` is a reminder that an issue can be deferred without
  risking the target release.

## Adding new labels

If you need to introduce a label, coordinate with maintainers first so we keep
an intentional set. Once agreed, add it via the GitHub UI or with the CLI:

```bash
gh label create "name" --color 123abc --description "What this covers"
```

After adding a new label, update this document and reference it from
[CONTRIBUTING.md](../../CONTRIBUTING.md).
