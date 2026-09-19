# Wesley v0.3.0-alpha.2 Verification

This packet records pre-release evidence for `v0.3.0-alpha.2` and the plan for
verifying its publication.

Publication evidence is intentionally not prefilled in the repository before the
tag exists. After the release tag publishes, the authoritative post-publish
evidence lives in the GitHub Release, the workflow logs, crates.io, and direct
registry checks; release truth must not depend on a post-publish backfill merge.

## Release Inputs

- Target version: `0.3.0-alpha.2`.
- Target tag: `v0.3.0-alpha.2`.
- Prep branch: `release/v0.3.0-alpha.2`.
- Release type: pre-release of the 0.3.0 line. It carries one additive
  `wesley-core` feature and two dependency removals, so it uses the shorter
  thesis the release policy allows for patch-style releases.
- Previous release tag: `v0.3.0-alpha.1`.
- Tracking issue: #803. It closes when the crates are visible on crates.io.
- Feature merge: PR #804 merged to `main` at
  `d444bbfa7` from `core/803-lean-core-resilience-feature`.
- Release-prep PR: #805. Its merge commit is the release commit; the tag records
  it, so it is not repeated here.
- Release boundary: one release tag on synced `main`, created as `RELEASE.md`
  describes at the time of tagging.

## Discovery

| Fact                              | Result                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Repository type                   | Mixed Rust/pnpm workspace.                                                                          |
| Rust release authority            | `wesley-core`, `wesley-emit-codec`, `wesley-emit-rust`, `wesley-emit-typescript`, and `wesley-cli`. |
| Unpublished Rust workspace member | `wesley-holmes` stays `publish = false` but follows workspace version lockstep.                     |
| Version sources bumped            | Five published manifests and their inter-crate pins, `wesley-holmes`, `package.json`, `Cargo.lock`. |
| `Cargo.lock` change               | Exactly six version lines, `0.3.0-alpha.1` to `0.3.0-alpha.2`.                                      |
| Public API change                 | None with default features. `--no-default-features` now removes the async lowering port.            |

## Docs Topics Audit

| Item           | Result                                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope          | Every tracked file under `docs/topics/` (24 files), searched for claims this release can change: `wesley-core` features and dependencies, what `cargo xtask preflight` runs, install and version pins, and the release command sequence. |
| Performed by   | The agent that prepared this release. Check 23 requires a human reviewer; that sign-off is the release checklist item on #805 and is not claimed here.                                                                                   |
| Accuracy score | 2 stale claims found among the release-relevant claims, both corrected in this PR, so 100% after correction. `validation.md` and `security-tooling.md` each listed what preflight runs and omitted the lean-core dependency check.       |
| Coverage score | 1 gap found and closed, so 100% after correction: no topic told a contributor changing `wesley-core` dependencies or features to run `cargo xtask lean-core-check`. `validation.md` now has that row.                                    |
| Not in scope   | Topic claims about how the release tag is created. #807 changes that procedure and updates those topics in the same PR.                                                                                                                  |

## Local Evidence

Run on 2026-09-19 from the prep branch at `85ae3bd3` with a clean tree, each
exiting 0:

```bash
cargo xtask release-prep-guard --version 0.3.0-alpha.2
cargo xtask preflight
cargo xtask legacy-preflight
cargo xtask docs-check
cargo xtask release-check
cargo audit
cargo xtask package-crates --version 0.3.0-alpha.2
```

`cargo audit` loaded 1,251 advisories, scanned 189 crate dependencies in
`Cargo.lock`, and reported no vulnerabilities and no warnings. `release-check`
built and smoked the optimized CLI and packaged every published crate;
`package-crates` listed the contents of all five. The commit that records this
evidence changes Markdown only. A later merge from `main` is covered by CI on
#805 and by the autotag workflow, which reruns `release-prep-guard`,
`release-check`, and the full `release-guard`, including `cargo audit`, on the
release commit itself before it creates the tag.

`cargo xtask preflight` includes `lean-core-check`, which tests `wesley-core`
without default features and fails if that build's dependency tree names
`async-trait`, `ninelives`, `tokio`, or `tower`. It was observed failing against
the unfixed crate, naming all four, before #804.

Measured with `cargo tree -p wesley-core -e normal --prefix none`:

| Build                      | Before #804 | After #804 |
| -------------------------- | ----------: | ---------: |
| default features           |          90 |         77 |
| `default-features = false` |          90 |         44 |

A downstream build-time tool pointed at #804 with `default-features = false`
went from 92 crates to 46, passed its 18 tests, and generated a byte-identical
artifact from `lower_schema_sdl` and `compute_registry_hash`.

## Review Evidence

- #804: all CI checks passed; CodeRabbit and Codex raised no findings.
- #805: Codex raised three findings on the first pass, two on the second, and
  four on the third. All nine were checked against the repository and are
  addressed on the PR.

## Publish Verification Plan

Do not infer success from queued or in-progress jobs.

1. Confirm `v0.3.0-alpha.2` points at the release-prep merge commit and that the
   commit is on `main`.
2. Confirm the publish workflow ran from that tag and that both of its jobs
   completed successfully.
3. Verify every published crate directly:

```bash
for crate in wesley-core wesley-emit-codec wesley-emit-rust wesley-emit-typescript wesley-cli; do
  cargo info "${crate}@0.3.0-alpha.2"
done
```

4. Confirm the GitHub Release exists for the tag, is marked a pre-release, and
   is not marked `latest`.
5. Confirm a fresh consumer resolves the lean build:

```toml
wesley-core = { version = "=0.3.0-alpha.2", default-features = false }
```

`cargo tree -e normal` for that consumer must name none of `async-trait`,
`ninelives`, `tokio`, or `tower`.

6. Close #803.

## Publish Evidence

Not prefilled. See the GitHub Release, the publish workflow run for the tag, and
crates.io.
