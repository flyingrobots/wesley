# Wesley v0.0.5 Verification

## Discovery

- Repository type: mixed Rust and Node workspace.
- Rust publishable units: `wesley-core`, `wesley-emit-rust`,
  `wesley-emit-typescript`, and `wesley-cli`.
- Node workspace version line: existing `0.1.0` package metadata, not changed
  by this Rust/repo release.
- Package managers: Cargo for Rust crates, pnpm for legacy/tooling workspace.
- Latest reachable release tag before prep: `v0.0.4`.
- Target version: `0.0.5`.
- Target tag: `v0.0.5`.
- Release authority: GitHub Actions tag workflow.
- Prep branch: `release/v0.0.5-finalize`.
- Release scope source: PR #511 merged into `main` as
  `fc826f630a9bede90f330961f8b0c97d71b91936`.

## Guard Evidence

| Command                                          | Result                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `git status --porcelain=v1 --branch`             | Passed; worktree was clean before release prep.                                                              |
| `git checkout main`                              | Passed.                                                                                                      |
| `git pull origin main`                           | Passed; fast-forwarded local `main` to `fc826f63`.                                                           |
| `git checkout -b release/v0.0.5-finalize`        | Passed.                                                                                                      |
| `git tag --list 'v0.0.5'`                        | Passed; no local tag collision.                                                                              |
| `git ls-remote --tags origin 'refs/tags/v0.0.5'` | Passed; no remote tag collision. Initial sandboxed run failed on DNS; escalated network run returned no tag. |

## Local Release Prep Evidence

| Command                                                 | Result                                                                                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cargo xtask docs-check`                                | Passed.                                                                                                                                                         |
| `cargo clippy --workspace --all-targets -- -D warnings` | Passed.                                                                                                                                                         |
| `cargo xtask release-check`                             | Passed outside the sandbox. Initial sandboxed run failed because git-backed CLI tests could not access GPG agent state for signed fixture commits.              |
| `cargo xtask release-prep-guard --version 0.0.5`        | Passed after removing version-specific release wording from the active backlog README.                                                                          |
| `cargo xtask package-crates --version 0.0.5`            | Passed.                                                                                                                                                         |
| `cargo audit`                                           | Passed. Initial sandboxed run could not lock the RustSec advisory database under `~/.cargo`; escalated run loaded 1096 advisories and found no vulnerabilities. |
| `pnpm install`                                          | Passed after adding pnpm overrides for patched transitive dependency versions. Existing peer/deprecation warnings were non-blocking.                            |
| `pnpm audit --prod=false`                               | Passed after dependency overrides; no known vulnerabilities found. Initial run reported `fast-uri`, `brace-expansion`, and `ws` advisories.                     |
| `pnpm run preflight`                                    | Passed.                                                                                                                                                         |
| `git diff --check`                                      | Passed.                                                                                                                                                         |

## Publication Evidence

| Check                   | Evidence                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release finalization PR | PR #512 merged into `main` as `fa42c71832520b70e55447e865e0425e467db2a5`.                                                                                                                |
| Release tag             | Signed annotated tag `v0.0.5` points to `fa42c71832520b70e55447e865e0425e467db2a5`.                                                                                                      |
| Tag signature           | `git tag -v v0.0.5` passed with RSA key `01A63D8E9DBEEDE32918AF9C39560E0406CA9135`.                                                                                                      |
| GitHub Release          | Published at <https://github.com/flyingrobots/wesley/releases/tag/v0.0.5> on `2026-05-21T23:05:14Z`; draft and prerelease flags are false.                                               |
| CI workflow             | `CI` run `26258049691` completed successfully for `v0.0.5` at `fa42c71832520b70e55447e865e0425e467db2a5`: <https://github.com/flyingrobots/wesley/actions/runs/26258049691>.             |
| Crates workflow         | `Release Crates` run `26258049690` completed successfully for `v0.0.5` at `fa42c71832520b70e55447e865e0425e467db2a5`: <https://github.com/flyingrobots/wesley/actions/runs/26258049690>. |
| Crates.io visibility    | Direct crates.io API checks returned HTTP `200` for `wesley-core`, `wesley-emit-rust`, `wesley-emit-typescript`, and `wesley-cli` version `0.0.5`.                                       |
