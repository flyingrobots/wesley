# Validation

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic to choose the right local validation before a PR, release, or
focused fix. The full gate is the default when in doubt.

## Default Gate

Run strict preflight before opening or updating a substantial PR:

```bash
cargo xtask preflight
```

The gate runs formatting, clippy, docs checks, workspace tests, and a native
CLI smoke test. JavaScript dependency advisories are handled by Dependabot and
the `dependency-review` workflow, not by preflight.

## Focused Checks

| Change Area                           | Useful Checks                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Markdown docs only                    | `cargo xtask docs-check`, `git diff --check`                                                      |
| Release governance docs               | `BATS_LIB_PATH=test/vendor bats -t test/release-governance.bats`                                  |
| Project manifest parser or CLI        | `cargo test -p wesley-core --test project_manifest`, `cargo test -p wesley-cli --test cli config` |
| CLI command surface                   | `cargo test -p wesley-cli --test cli`, `node scripts/check-doc-cli-commands.mjs`                  |
| GitHub workflows                      | `BATS_LIB_PATH=test/vendor bats -t test/ci-workflows.bats`                                        |
| Domain-empty boundary                 | `BATS_LIB_PATH=test/vendor bats -t test/domain-empty-boundary.bats`                               |
| HOLMES PR comments or reports         | `node --test packages/wesley-holmes/test/pr-comment.test.mjs`                                     |
| JavaScript package or lockfile policy | `cargo xtask legacy-preflight`, `pnpm lint`                                                       |
| Security-tooling policy or docs       | `cargo xtask docs-check`, `git diff --check`                                                      |

The pre-push hook may select relevant checks, but do not use the hook as the
only plan for a risky change. Choose checks deliberately and record the
important ones in the PR.

## Release Validation

Release validation is stricter than PR validation. Use
[`docs/topics/releases.md`](./releases.md) and
[`docs/method/release-runbook.md`](../method/release-runbook.md) before tagging.

## Related Authority

- [`docs/governance/RELEASE_POLICY.md`](../governance/RELEASE_POLICY.md)
- [`docs/governance/DOCUMENTATION_STANDARD.md`](../governance/DOCUMENTATION_STANDARD.md)
- [`docs/topics/security-tooling.md`](./security-tooling.md)
- [`docs/reference/cli.md`](../reference/cli.md)
