# Topics

<!-- docs-truth: status=current owner=@flyingrobots -->

Topic pages answer operator and contributor questions that cut across reference,
architecture, METHOD, and release docs. They are not backlog trackers.

Use these pages when you know the task you are trying to perform and need the
short path to the authoritative surface.

## Topic Map

| Task                                                         | Start Here                                  | Authority                                                    |
| ------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------ |
| Decide whether a change belongs in Wesley or an extension.   | [Compiler Boundary](./compiler-boundary.md) | `docs/design/0014-domain-empty-core-boundary/`               |
| Configure schema sets, changed-schema selection, or targets. | [Project Manifests](./project-manifests.md) | `docs/reference/project-manifest.md`                         |
| Choose local checks before a PR or release.                  | [Validation](./validation.md)               | `cargo xtask preflight`, `docs/governance/RELEASE_POLICY.md` |
| Understand HOLMES CI and evidence artifacts.                 | [HOLMES CI](./holmes-ci.md)                 | `.github/workflows/wesley-holmes.yml`, `docs/architecture/`  |
| Prepare or judge a release.                                  | [Releases](./releases.md)                   | `docs/method/release-runbook.md`, `docs/governance/`         |
| Triage issues into release lanes.                            | [Issue Triage](./contributing/triage.md)    | GitHub Issues, Milestones, Projects, and labels              |

## Coverage Rule

When a release changes a contributor or operator workflow, `docs/topics/` must
either cover that workflow directly or link clearly to the current
authoritative page. Topic pages may summarize, but they must not duplicate live
roadmap state, issue counts, or release progress.

The release gate for this directory is defined in
[`docs/governance/RELEASE_POLICY.md`](../governance/RELEASE_POLICY.md) and the
execution runbook in [`docs/method/release-runbook.md`](../method/release-runbook.md).
