<!-- docs-truth: status=current owner=@flyingrobots -->

# Release Process

Wesley follows the Continuum release lifecycle, adapted to this repository's
actual shape: a domain-free Rust compiler/toolchain that publishes crates from
immutable release tags on synced `main`.

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

- Implementation work stays in `Goalpost: ...` GitHub milestones.
- Version scheduling uses concrete `vX.Y.Z` labels because GitHub issues can
  have only one milestone.
- `Release: vX.Y.Z` milestones hold release-gate and closeout issues only.
- Release guards query exact-version issue references and `vX.Y.Z` labels, not
  release-gate milestones.
- Autotag is enabled. When a `release/vX.Y.Z` prep PR merges,
  `.github/workflows/release-autotag.yml` waits for the commit's other CI runs,
  runs the full release guard against a local annotated tag, and pushes that tag
  only if `main` is still the release commit. It never publishes and never moves
  a tag.
- An autotagged tag is unsigned. Its provenance is the autotag workflow run, not
  a maintainer's key. A manually created fallback tag is signed.
- Publication runs `.github/workflows/release-crates.yml` from the tag. A tag
  pushed with a workflow's `GITHUB_TOKEN` does not trigger on-push-tag
  workflows, so an autotagged release is published by dispatching that workflow
  from the tag. A manually pushed tag still triggers it directly.
- crates.io is the public package registry. npm/JSR dist-tag policy does not
  apply to Wesley's current release surface.

## Commands

Prepare:

```bash
cargo xtask release-prep-guard --version X.Y.Z
cargo xtask preflight
cargo xtask release-check
cargo xtask package-crates --version X.Y.Z
```

Merge the release-prep PR. Autotag creates `vX.Y.Z` and prints the publish
command:

```bash
gh workflow run release-crates.yml --ref vX.Y.Z
```

The publish workflow runs `release-guard` against the tag, then publishes the
crates and the GitHub Release from the immutable tag.

Manual fallback, only when autotag cannot run, and never to bypass a failed
gate. Tag from synced `main`:

```bash
git switch main
git pull --ff-only
git fetch origin --tags
git tag -s vX.Y.Z -m "release: vX.Y.Z"
cargo xtask release-guard --tag vX.Y.Z
git push origin vX.Y.Z
```

## Canonical Docs

- [Release doctrine](docs/method/release.md)
- [Execution runbook](docs/method/release-runbook.md)
- [Release policy](docs/governance/RELEASE_POLICY.md)
- [Human checklist](docs/governance/RELEASE_CHECKLIST.md)
- [Crates.io procedure](docs/CRATES_IO_RELEASE.md)
- [Release topic](docs/topics/releases.md)

Do not move public tags. If a public release is wrong, patch forward.
