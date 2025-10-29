# Issue & PR Labels

Wesley uses a small, well-documented label set so contributors can quickly find
work and maintainers can triage effectively. All labels are applied directly on
GitHub and can be reviewed with `gh label list`.

| Label | Purpose |
| ----- | ------- |
| `bug` | Reproducible product bug that needs a fix. |
| `feature` / `enhancement` | User-facing functionality requests. `feature` is used for roadmap work, `enhancement` for smaller improvements. |
| `chore` | Internal maintenance (refactors, dependency bumps, repo hygiene). |
| `docs` / `documentation` | Documentation work (README, guides, docs site). |
| `tests` | Test coverage or flakiness fixes. |
| `security` | Security or compliance related tasks. |
| `ci` | Changes to automation or workflows. |
| `rfc` | Exploratory proposals that require design discussion. |
| `blocked` / `needs-discussion` | Work waiting on a decision or external dependency. |
| `good first issue` | Curated onboarding tasks for newcomers. |
| `help wanted` | We actively need contributions for this issue. |
| `holmes`, `scoring` | Work specific to the HOLMES evidence stack. |
| `status: non-blocking` | Nice-to-have items that are not release blockers. |
| `pkg:*` | Ownership hints for the affected package(s). |

## Label conventions

- Every newly opened issue should get **one work-type label** (bug/feature/chore/docs/tests).
- Use **module labels** (`pkg:*`) when the work sits in a single package; skip
  them for cross-cutting features.
- Add `good first issue` only if the description already includes clear steps
  and the acceptance criteria can be completed without repo-wide context.
- `status: non-blocking` is a reminder that an issue can be deferred without
  risking the next milestone.

## Adding new labels

If you need to introduce a label, coordinate with maintainers first so we keep
an intentional set. Once agreed, add it via the GitHub UI or with the CLI:

```bash
gh label create "name" --color 123abc --description "What this covers"
```

After adding a new label, update this document and reference it from
[CONTRIBUTING.md](../../CONTRIBUTING.md).
