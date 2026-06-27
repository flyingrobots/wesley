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

- Implementation work stays in `Goalpost: ...` GitHub milestones.
- Version scheduling uses concrete `vX.Y.Z` labels because GitHub issues can
  have only one milestone.
- `Release: vX.Y.Z` milestones hold release-gate and closeout issues only.
- Release guards query exact-version issue references and `vX.Y.Z` labels, not
  release-gate milestones.
- Autotag is not enabled. Maintainers create a signed tag manually after final
  release guards pass from synced `main`.
- Publication is tag-triggered through `.github/workflows/release-crates.yml`.
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

Tag from synced `main` only:

```bash
git switch main
git pull --ff-only
git fetch origin --tags
git tag -s vX.Y.Z -m "release: vX.Y.Z"
cargo xtask release-guard --tag vX.Y.Z
git push origin vX.Y.Z
```

The tag workflow publishes the crates and GitHub Release from the immutable tag.

## Canonical Docs

- [Release doctrine](docs/method/release.md)
- [Execution runbook](docs/method/release-runbook.md)
- [Release policy](docs/governance/RELEASE_POLICY.md)
- [Human checklist](docs/governance/RELEASE_CHECKLIST.md)
- [Crates.io procedure](docs/CRATES_IO_RELEASE.md)
- [Release topic](docs/topics/releases.md)

Do not move public tags. If a public release is wrong, patch forward.
