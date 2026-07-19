<!-- docs-truth: status=current owner=@flyingrobots -->

# Release Process

Wesley follows the Continuum release lifecycle, adapted to this repository's
actual shape: a domain-free Rust compiler/toolchain that publishes crates from
signed tags on synced `main`.

The rule is:

```text
plan deliberately -> merge reviewed main -> tag immutably -> publish from tag -> verify publicly -> record evidence
```

## Repo Profile

Repo-specific mechanics live in [`.continuum/release.yml`](.continuum/release.yml).
That profile declares:

- version sources
- published crates
- release signposts
- validation commands
- publish workflow
- GitHub issue model
- release evidence paths

Do not duplicate those facts in prose unless the profile changes too.

## Wesley Shape

Wesley intentionally differs from the generic Continuum template in these
places:

Plain `vX.Y.Z` milestones are the only release scheduling axis. Every
prerelease uses its exact full tag-form SemVer as the plain milestone name (for
example, `v0.3.0-alpha.2`), without a `Release:` prefix.

- Every issue committed to a release belongs to exactly one plain `vX.Y.Z`
  milestone and has no `triage:*` or concrete-version scheduling label.
- The same milestone contains implementation, documentation, preparation, and
  the release-gate issue.
- Release outcomes are narrative groupings in release packets or Project views,
  not scheduling authorities.
- The release gate is the final pre-tag issue in that milestone: move or close
  every other open issue, then close the gate before tagging.
- Release guards query the exact target milestone as the sole scheduling
  authority rather than relying on labels or a manually maintained manifest.
- Autotag is not enabled. Maintainers create a signed local tag manually after
  the post-merge, pre-tag checks pass from synced `main`; the tag-specific guard
  then passes before that tag is pushed.
- Publication is tag-triggered through `.github/workflows/release-crates.yml`.
- crates.io is the public package registry. npm/JSR dist-tag policy does not
  apply to Wesley's current release surface.

## Commands

Prepare:

```bash
cargo xtask preflight
cargo xtask release-check
cargo xtask package-crates --version X.Y.Z
```

After the release-prep PR lands, keep the release gate open while syncing and
running the fresh pre-tag preflight. Record the exact commit that passed:

```bash
git fetch origin --tags --prune
git switch main
git merge --ff-only origin/main
validated_head="$(git rev-parse HEAD)"
test "$validated_head" = "$(git rev-parse origin/main)"
cargo xtask preflight

# Only now: complete human sign-off and close the release gate.
cargo xtask release-prep-guard --version X.Y.Z

# Refresh refs and prove HEAD is still the validated, synced commit.
git fetch origin --tags --prune
test "$(git rev-parse HEAD)" = "$validated_head"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
git tag -s vX.Y.Z -m "release: vX.Y.Z"
cargo xtask release-guard --tag vX.Y.Z
git push origin vX.Y.Z
```

If anything fails after gate closure, do not push again. Follow the execution
runbook to resolve remote tag state first. Only a conclusively unpublished
failure may delete the local tag and reopen the gate; a present or indeterminate
remote tag must not mutate either. Never delete, move, or recreate a tag that
reached the remote.

The tag workflow publishes the crates and GitHub Release from the immutable tag.

## Canonical Docs

- [Release doctrine](docs/method/release.md)
- [Execution runbook](docs/method/release-runbook.md)
- [Release policy](docs/governance/RELEASE_POLICY.md)
- [Human checklist](docs/governance/RELEASE_CHECKLIST.md)
- [Crates.io procedure](docs/CRATES_IO_RELEASE.md)
- [Release topic](docs/topics/releases.md)

Do not move public tags. If a public release is wrong, patch forward.
