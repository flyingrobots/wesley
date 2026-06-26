# HOLMES CI

<!-- docs-truth: status=current owner=@flyingrobots -->

HOLMES CI is Wesley's evidence sidecar in pull requests. It consumes explicit
artifacts and writes review evidence; it does not decide product semantics or
reinterpret GraphQL structure.

## Current Flow

```text
wesley.config.json
  -> wesley config changed-schemas
  -> schema-scoped HOLMES matrix jobs
  -> grouped reports
  -> one aggregate PR comment
```

The workflow uses the project manifest to decide which schema sets to analyze.
If no changed files are available, every schema set is selected. If no schema
set matches the changed files, the HOLMES matrix is skipped rather than
inventing work.

## Operator Notes

- CodeRabbit and HOLMES are separate review surfaces.
- HOLMES report artifacts are grouped by schema set.
- The dashboard artifact is an artifact viewer, not a Wesley website product.
- `commentMode: silent` suppresses the aggregate PR comment; it does not skip
  schema-set analysis or report artifacts.
- Invalid manifests fail the workflow. Legacy fallback is only for the
  no-manifest case.
- Missing or invalid report artifacts should be reported as unavailable or
  diagnostic evidence, not hidden behind a passing workflow.
- Target-specific facts belong in external modules that generate their own
  evidence.

## Local Checks

```bash
cargo run --bin wesley -- config validate --json
cargo run --bin wesley -- config changed-schemas --json
BATS_LIB_PATH=test/vendor bats -t test/ci-workflows.bats
node --test packages/wesley-holmes/test/pr-comment.test.mjs
```

## Related Authority

- [`docs/architecture/holmes-integration.md`](../architecture/holmes-integration.md)
- [`docs/architecture/holmes-architecture.md`](../architecture/holmes-architecture.md)
- [`docs/reference/project-manifest.md`](../reference/project-manifest.md)
- [`.github/workflows/wesley-holmes.yml`](../../.github/workflows/wesley-holmes.yml)
