# Topics

<!-- docs-truth: status=current owner=@flyingrobots -->

Topic pages answer operator and contributor questions that cut across reference,
architecture, METHOD, and release docs. They are not backlog trackers.

Use these pages when you know the task you are trying to perform and need the
short path to the authoritative surface.

## Topic Map

### Compiler Use

| Task                                      | Start Here                                      | Authority                                  |
| ----------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| Complete the first-hour compiler path.    | [Plain Wesley](./plain-wesley.md)               | `docs/reference/cli.md`                    |
| Run the current product command surface.  | [Native CLI](./native-cli.md)                   | `docs/reference/cli.md`                    |
| Inspect GraphQL lowering, hashes, or IR.  | [Schema And IR](./schema-ir.md)                 | `docs/reference/cli.md#schema`             |
| Work with operations and directive args.  | [Operations](./operations.md)                   | `docs/reference/cli.md#operation`          |
| Use or classify GraphQL directives.       | [Directives](./directives.md)                   | `docs/reference/directives.md`             |
| Author or validate `weslaw/v1`.           | [Weslaw](./weslaw.md)                           | `docs/design/0019-weslaw-semantic-law-ir/` |
| Emit Rust, TypeScript, or LE-binary code. | [Emitters](./emitters.md)                       | `docs/reference/cli.md#emit`               |
| Understand generated files and caches.    | [Artifacts And Cache](./artifacts-and-cache.md) | `docs/build-artifacts.md`                  |

### Boundaries And Extension

| Task                                                         | Start Here                                  | Authority                                                                              |
| ------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Decide whether a change belongs in Wesley or an extension.   | [Compiler Boundary](./compiler-boundary.md) | `docs/design/0014-domain-empty-core-boundary/`                                         |
| Configure schema sets, changed-schema selection, or targets. | [Project Manifests](./project-manifests.md) | `docs/reference/project-manifest.md`                                                   |
| Author descriptor fixtures or embed semantic generators.     | [Extension Modules](./extension-modules.md) | `docs/reference/extension-generation.md`, `docs/reference/external-target-protocol.md` |
| Handle old Node, host, or package references.                | [Legacy Node Retirement](./legacy-node.md)  | `docs/LEGACY_NODE_MIGRATION.md`                                                        |
| Check durable repo properties.                               | [Invariants](./invariants.md)               | `docs/invariants/README.md`                                                            |

### Assurance, CI, And Release

| Task                                        | Start Here                                    | Authority                                                                          |
| ------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Choose local checks before a PR or release. | [Validation](./validation.md)                 | `cargo xtask preflight`, `docs/governance/RELEASE_POLICY.md`                       |
| Interpret GitHub Actions checks.            | [CI Workflows](./ci-workflows.md)             | `docs/ci.md`, `.github/workflows/`                                                 |
| Evaluate security scanners and gates.       | [Security Tooling](./security-tooling.md)     | `SECURITY.md`, `.github/workflows/`, `docs/governance/RELEASE_POLICY.md`           |
| Understand HOLMES CI and PR comments.       | [HOLMES CI](./holmes-ci.md)                   | `.github/workflows/wesley-holmes.yml`, `docs/architecture/`                        |
| Work with assurance evidence and policies.  | [Assurance Evidence](./assurance-evidence.md) | `docs/reference/assurance-capability-matrix.md`, `docs/holmes-policy-spec.md`      |
| Prepare or judge a release.                 | [Releases](./releases.md)                     | `.continuum/release.yml`, `docs/method/release.md`, `docs/governance/`             |
| Refresh docs before a release tag.          | [Docs Maintenance](./docs-maintenance.md)     | `docs/governance/RELEASE_POLICY.md#check-23-docstopics-accuracy-and-coverage-gate` |

### Contributor Process

| Task                               | Start Here                                             | Authority                                       |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Make a first small PR.             | [First PR](./contributing/first-pr.md)                 | `CONTRIBUTING.md`, GitHub Issues                |
| Make a first generic compiler PR.  | [Plain Wesley](./plain-wesley.md#contributor-tutorial) | `docs/guides/extending.md`                      |
| Find the right documentation path. | [Docs Orientation](./docs-orientation.md)              | `docs/README.md`                                |
| Schedule or triage issues.         | [Issue Triage](./contributing/triage.md)               | GitHub Issues, plain version milestones, labels |
| Keep docs accurate and covered.    | [Docs Maintenance](./docs-maintenance.md)              | `docs/governance/DOCUMENTATION_STANDARD.md`     |

## Coverage Rule

When a release changes a contributor or operator workflow, `docs/topics/` must
either cover that workflow directly or link clearly to the current
authoritative page. Topic pages may summarize, but they must not duplicate live
roadmap state, issue counts, or release progress.

When a PR adds or materially changes a public capability, command family,
workflow, invariant, release procedure, or extension boundary, update this topic
map or state why the existing topic path already covers it.

The release gate for this directory is defined in
[`docs/governance/RELEASE_POLICY.md`](../governance/RELEASE_POLICY.md) and the
execution runbook in [`docs/method/release-runbook.md`](../method/release-runbook.md).
