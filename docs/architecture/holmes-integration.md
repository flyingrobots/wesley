# Wesley HOLMES Integration

<!-- docs-truth: status=current owner=@flyingrobots -->

HOLMES is Wesley's assurance sidecar. It consumes explicit evidence artifacts
and reports on their quality. It does not become the source of truth for
GraphQL shape, application semantics, target behavior, or product policy.

The current CI integration is intentionally narrow:

```text
wesley.config.json
  -> wesley config changed-schemas
  -> schema-scoped HOLMES matrix jobs
  -> grouped report artifacts
  -> one aggregate PR comment
```

## Ownership Boundary

| Surface                                               | Owner                                     |
| ----------------------------------------------------- | ----------------------------------------- |
| GraphQL SDL parsing and deterministic IR              | `wesley-core`                             |
| Project manifest parsing and changed-schema selection | `wesley-core` and `wesley-cli`            |
| Evidence fixture preparation in this repo             | `scripts/prepare-shipme-cert-fixture.mjs` |
| HOLMES, WATSON, and MORIARTY report rendering         | `packages/wesley-holmes`                  |
| Target semantics and runtime behavior                 | External target modules or sibling repos  |

HOLMES may judge evidence quality. It must not reinterpret the schema or decide
what a database, runtime, renderer, scheduler, or product target means.

## Project Manifest Input

The workflow reads the current
[Project Manifest](../reference/project-manifest.md) before falling back to
legacy heuristic detection. A manifest can declare multiple schema sets:

```json
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": [
    {
      "id": "ecommerce",
      "path": "test/fixtures/examples/ecommerce.graphql",
      "rebuildOnGlobs": ["test/fixtures/examples/ecommerce.graphql"]
    },
    {
      "id": "reference",
      "path": "test/fixtures/reference/schema.graphql",
      "rebuildOnGlobs": ["test/fixtures/reference/**"]
    }
  ],
  "bundleDir": "test/fixtures/examples/.wesley-cache",
  "rebuildOnGlobs": ["wesley.config.json"]
}
```

The detection job computes changed files from the PR or push diff, then runs:

```bash
wesley config inspect --json
wesley config changed-schemas --changed-file "$changed_file" --json
```

If no changed files are available, every schema set is selected. If changed
files match a schema-local glob, only that schema set is selected. If changed
files match a top-level rebuild glob, every schema set is selected. If no
schema set matches, the workflow skips the HOLMES matrix.

For multi-schema manifests, selected schema sets receive isolated bundle
directories below `bundleDir`, such as:

```text
test/fixtures/examples/.wesley-cache/ecommerce
test/fixtures/examples/.wesley-cache/reference
```

## Matrix Jobs

`.github/workflows/wesley-holmes.yml` runs these jobs:

| Job                  | Responsibility                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `detect-schema-sets` | Build the selected schema-set matrix from the manifest and changed files. |
| `wesley-generate`    | Prepare the evidence bundle for each selected schema set.                 |
| `holmes-investigate` | Run the HOLMES investigation report per selected schema set.              |
| `watson-verify`      | Run the WATSON verification report per selected schema set.               |
| `moriarty-predict`   | Run the MORIARTY forecast per selected schema set.                        |
| `comment-report`     | Download grouped reports and update one aggregate PR comment.             |

Report artifacts are grouped by schema set:

```text
reports/
  ecommerce/
    holmes/holmes-report.json
    watson/watson-report.json
    moriarty/moriarty-report.json
  reference/
    holmes/holmes-report.json
    watson/watson-report.json
    moriarty/moriarty-report.json
```

The PR comment builder detects that grouped layout and renders one anchored
comment with separate sections for each schema set.

Manifest `commentMode` controls the final PR comment behavior:

| Mode     | Behavior                                    |
| -------- | ------------------------------------------- |
| `update` | Create or update one anchored PR comment.   |
| `append` | Create a new PR comment for each run.       |
| `silent` | Run analysis but do not write a PR comment. |

## Distribution Boundary

HOLMES should be packaged for external users as a tagged reusable workflow with
documented workflow templates. That keeps execution inside the consumer
repository's GitHub Actions environment, where checkout state, permissions,
artifacts, and logs are inspectable by the repository owner.

A GitHub App is not the first-class delivery mechanism. It remains deferred
unless HOLMES needs a durable certifying identity, Checks API ownership,
cross-repo dashboards, or organization-level policy orchestration. If such an
app exists later, it should consume evidence produced by repository-local
Actions runs rather than becoming a hidden compiler or source of target
semantics.

## Dashboard Artifact

The workflow uploads `docs/holmes-dashboard` as a dashboard template and
assembles a `holmes-dashboard` artifact with the available suite JSON reports.
The dashboard is an artifact viewer, not a separate product website.

## Current Fixture Limitation

The repository workflow still uses
`scripts/prepare-shipme-cert-fixture.mjs` to create deterministic local evidence
fixtures when a bundle is missing or regeneration is requested. That script is a
test fixture generator for the assurance workflow. It is not a general
Wesley-generated database, validation, or product artifact pipeline.

Target modules that need real domain artifacts should generate them in their
own repo or through an explicitly designed external target boundary.

## Local Checks

Useful focused checks:

```bash
cargo run --bin wesley -- config validate --json
cargo run --bin wesley -- config changed-schemas \
  --changed test/fixtures/examples/ecommerce.graphql \
  --json
BATS_LIB_PATH=test/vendor bats -t test/ci-workflows.bats
node --test packages/wesley-holmes/test/pr-comment.test.mjs
```

Run the full gate before opening a PR:

```bash
cargo xtask preflight
```
