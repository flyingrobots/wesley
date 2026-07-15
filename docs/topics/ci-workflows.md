# CI Workflows

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when choosing or interpreting GitHub Actions checks.

CI protects the Rust product spine, repository hygiene, retained package
surfaces, and assurance evidence. It is not a substitute for reading the local
diff or running focused checks before a PR.

## Check Families

| Family                       | Protects                                           |
| ---------------------------- | -------------------------------------------------- |
| Rust product preflight       | Native compiler crates, CLI, tests, clippy.        |
| Repository hygiene preflight | Docs links, truth manifest, policy hygiene.        |
| Compatibility smoke          | Workspace compatibility and Rust product smoke.    |
| CodeQL / analysis            | Static analysis for supported languages.           |
| Dependency review            | Dependency risk in PRs.                            |
| Security posture             | Advisory gates, scanner fit, and false positives.  |
| HOLMES workflow              | Schema-selected assurance reports and PR comments. |
| SHIPME certificate           | Post-merge evidence for the landed `main` SHA.     |
| Crates release publishing    | Signed-tag crate publish and GitHub release cut.   |

## Local Mirrors

Run the full product gate:

```bash
cargo xtask preflight
```

Run docs-only checks:

```bash
cargo xtask docs-check
git diff --check
```

Run workflow invariant tests:

```bash
BATS_LIB_PATH=test/vendor bats -t test/ci-workflows.bats
```

## Rules Of Thumb

- A skipped HOLMES matrix can be correct when no schema set is selected.
- SHIPME certification is post-merge only. PR checks evaluate the proposed
  integration; SHIPME certifies the commit that actually lands on `main`.
- Browser, Bun, and Deno host experiment workflows are retired from Wesley.
- Required checks should name the Rust product or repository hygiene surface
  they protect.
- The crates release workflow classifies the tag channel from its SemVer
  suffix: pre-release tags (for example `v0.3.0-alpha.1`) publish as GitHub
  pre-releases and are not marked `latest`; stable tags publish as `latest`.
- Git hooks export `GIT_DIR`/`GIT_WORK_TREE` into child processes, so the
  pre-push checks and the CLI git tests strip them to keep nested fixture
  repositories from mutating the caller's repository.
- Do not widen workflow permissions or secret exposure casually.

## Related Authority

- [Continuous Integration](../ci.md)
- [Security Tooling](./security-tooling.md)
- [HOLMES CI](./holmes-ci.md)
- [Validation](./validation.md)
- [Release Workflow](./releases.md)
