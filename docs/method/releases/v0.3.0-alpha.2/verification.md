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
- Release type: pre-release of the 0.3.0 line. It carries three goalposts,
  named with their acceptance evidence in [`release.md`](./release.md).
- Previous release tag: `v0.3.0-alpha.1`.
- Tracking issue: #803. It closes when the crates are visible on crates.io.
- Feature merges to `main`: #804 at `d444bbfa7` (lean core), #811 at
  `f46a7d5b3` (exact sibling pins), and #807 at `bc2069527` (autotag).
- Release-prep PR: #805. Its merge commit is the release commit; the tag records
  it, so it is not repeated here.
- Release boundary: one annotated release tag on synced `main`, created by the
  autotag workflow when #805 merges.

## Discovery

| Fact                              | Result                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Repository type                   | Mixed Rust/pnpm workspace.                                                                          |
| Rust release authority            | `wesley-core`, `wesley-emit-codec`, `wesley-emit-rust`, `wesley-emit-typescript`, and `wesley-cli`. |
| Unpublished Rust workspace member | `wesley-holmes` stays `publish = false` but follows workspace version lockstep.                     |
| Version sources bumped            | Five published manifests, `wesley-holmes`, `package.json`, `Cargo.lock`.                            |
| Sibling requirements              | All eight are `=0.3.0-alpha.2`. `cargo metadata --locked` reports that requirement on every edge.   |
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

Run on 2026-09-19 from the prep branch at `1aef2d4a` with a clean tree, each
exiting 0. That commit already contains #811 and #807, merged in from `main`:

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
`package-crates` listed the contents of all five. All eleven non-e2e bats
suites passed at the same commit. The tree was clean before and after. The
commit that records this evidence changes Markdown only. An earlier run of the
same seven commands at `85ae3bd3`, before `main` was merged in, also exited 0.

That evidence is for `1aef2d4a`, not for the release commit. The same checks
must pass on the release commit itself before `v0.3.0-alpha.2` exists, because
a failure found after tagging cannot be fixed on an immutable tag. The autotag
workflow does that: it waits for the release commit's CI, which runs
`legacy-preflight`, then reruns `release-prep-guard`, `release-check`, and the
full `release-guard` on that commit, and creates the tag only if they pass.
`release-guard` runs `preflight`, which includes `docs-check`, and
`cargo audit`; `release-check` packages every published crate. If autotag
cannot run, the maintainer reruns all seven by hand on synced `main` before
creating the signed fallback tag, as `docs/CRATES_IO_RELEASE.md` requires.

Autotag's first run on `main`, for the #807 merge commit `bc2069527`, found the
merged pull request, decided `skip` because `ci/806-autotag-release-prep` is
not a release-prep branch, ran none of the tagging steps, and succeeded.

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
- #805: Codex raised eleven findings and CodeRabbit one. All were checked against
  the repository and are addressed on the PR.
- #811: Codex raised three findings, each a form of sibling dependency the guard
  did not read. All are fixed, with tests that were red first.
- #807: Codex raised sixteen findings and CodeRabbit four. All are fixed on the
  PR except one: verifying inside `release-guard` that a tag is annotated is
  deferred to #808, with the reason recorded there.

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
