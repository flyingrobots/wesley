# Wesley v0.0.4 Verification

## Discovery

- Repository type: mixed Rust and Node workspace.
- Rust publishable units: `wesley-core`, `wesley-emit-rust`,
  `wesley-emit-typescript`, and `wesley-cli`.
- Package managers: Cargo for Rust crates, pnpm for legacy/tooling workspace.
- Latest reachable release tag before prep: `v0.0.3`.
- Target version: `0.0.4`.
- Target tag: `v0.0.4`.
- Release authority: GitHub Actions tag workflow.
- Prep branch: `release/v0.0.4`.

## Guard Evidence

| Command                                              | Result                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `git status --porcelain=v1`                          | Passed; worktree was clean before release prep.                                       |
| `git rev-parse --abbrev-ref HEAD`                    | Passed; release prep started from `main`.                                             |
| `git fetch origin main --tags --prune`               | Passed.                                                                               |
| `git rev-parse HEAD` and `git rev-parse origin/main` | Passed; both resolved to `84ed74068cbfcecb8f88a73edb726e69ed98dea0` before branching. |
| `git tag --list 'v0.0.4'`                            | Passed; no local tag collision.                                                       |
| `git ls-remote --tags origin 'refs/tags/v0.0.4'`     | Passed; no remote tag collision.                                                      |

## Local Release Prep Evidence

| Command                                                 | Result  |
| ------------------------------------------------------- | ------- |
| `cargo xtask docs-check`                                | Passed. |
| `cargo check --workspace --all-targets`                 | Passed. |
| `cargo test --workspace --all-features`                 | Passed. |
| `cargo clippy --workspace --all-targets -- -D warnings` | Passed. |
| `cargo xtask release-check`                             | Passed. |
| `cargo audit`                                           | Passed. |
| `cargo xtask release-prep-guard --version 0.0.4`        | Passed. |
| `cargo xtask package-crates --version 0.0.4`            | Passed. |
| `cargo test -p wesley-core runtime_optic`               | Passed. |
| `pnpm run preflight`                                    | Passed. |
| `git diff --check`                                      | Passed. |

## Publication Evidence

Publication is pending the tag-triggered GitHub Actions release workflow.
Do not treat this packet as crates.io publication evidence until the release
workflow has completed and registry visibility has been checked directly.
