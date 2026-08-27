# Releases

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when preparing, reviewing, or judging a Wesley release.

Wesley releases are cut from synced `main` only. A feature branch or PR can
prepare release facts, but the tag must point at the merged `main` commit.

## Release Shape

Release state is split intentionally:

| Surface                                       | Purpose                                      |
| --------------------------------------------- | -------------------------------------------- |
| GitHub label `vX.Y.Z`                         | Scheduled work and pre-tag blockers          |
| GitHub milestone `Release: vX.Y.Z`            | Release-gate and closeout issue only         |
| GitHub goalpost milestones                    | Implementation issues                        |
| `CHANGELOG.md`                                | Historical ledger of merged behavior         |
| `.continuum/release.yml`                      | Repo-local release profile and publish facts |
| `docs/method/releases/vX.Y.Z/release.md`      | Internal release design and scope            |
| `docs/method/releases/vX.Y.Z/verification.md` | Release witness after validation and publish |
| `docs/releases/vX.Y.Z.md`                     | User-facing release notes                    |

Implementation issues stay in goalpost milestones. Release-gate issues link to
the selected goalposts and release-lane queries. The executable release guards
query version labels and exact-version references for blockers; they do not
block merely because the `Release: vX.Y.Z` gate issue remains open for
post-publication evidence.

## Required Human Checks

Before tagging, a reviewer must complete the human checklist in
[`docs/governance/RELEASE_CHECKLIST.md`](../governance/RELEASE_CHECKLIST.md).
That includes:

- CHANGELOG accuracy against the actual diff
- architecture doc currency
- guide claim accuracy
- `docs/topics/` accuracy and coverage
- no known issue being silently shipped
- confirmation that synced `main` is the release boundary

The `docs/topics/` gate means this directory must cover release-relevant
contributor and operator workflows or link clearly to the current authority.

## Release Lifecycle

Wesley uses the lifecycle defined in
[`docs/method/release.md`](../method/release.md):

```text
planned -> active -> release-prep -> merged -> tagged -> published -> verified -> retrospected -> closed
```

The live tracker shape is Wesley-specific: goalpost milestones own
implementation slices, release milestones own release-gate issues, and concrete
`vX.Y.Z` labels are the version scheduling axis. This is intentional because a
GitHub issue can carry only one milestone.

## Pre-Release Channels

A tag whose version carries a SemVer pre-release suffix (for example
`v0.3.0-alpha.1`, `-beta.N`, or `-rc.N`) is published as a GitHub Release marked
`prerelease` and is not promoted to `latest`; stable `vX.Y.Z` tags publish as
`latest`. The crates release workflow
([`.github/workflows/release-crates.yml`](../../.github/workflows/release-crates.yml))
classifies the channel from the tag itself, so no separate configuration is
needed, and crates are published to crates.io for both channels.

Pre-releases are cut the same way as stable releases — from synced `main`, under
the same guards — but are opt-in previews whose APIs and emitted artifacts may
change before the stable `vX.Y.Z`. `v0.3.0-alpha.1` is the first Wesley
pre-release, cut to unblock downstream consumers.

## Pre-Tag Launch Pass

After the release-prep PR lands on `main` but before creating the signed tag,
run one last docs/signpost audit. The goal is not to create a progress tracker;
it is to make sure the tagged commit tells the truth without a post-release
backfill.

Check these durable surfaces at minimum:

- `README.md`
- `docs/README.md`
- `docs/GUIDE.md`
- `docs/ENTRYPOINTS.md`
- `docs/BEARING.md`
- `docs/releases/vX.Y.Z.md`
- `docs/method/releases/vX.Y.Z/release.md`
- `docs/method/releases/vX.Y.Z/verification.md`
- every tracked file under `docs/topics/`

Pre-publication install wording must be honest. It may show the target
`cargo install wesley-cli --version X.Y.Z` command, but it must not claim the
version is already published until the signed tag workflow has actually
published it.

## Command Sequence

The exact abort-fast sequence lives in
[`docs/method/release-runbook.md`](../method/release-runbook.md). The major
guards are:

```bash
git status --porcelain
git fetch origin --tags
cargo xtask release-prep-guard --version X.Y.Z
cargo xtask preflight
cargo xtask release-check
cargo xtask release-guard --tag vX.Y.Z
```

Run `release-guard` only after the signed tag exists locally and points at the
synced `main` release commit.

## Related Authority

- [`.continuum/release.yml`](../../.continuum/release.yml)
- [`docs/method/release.md`](../method/release.md)
- [`docs/method/release-runbook.md`](../method/release-runbook.md)
- [`docs/governance/RELEASE_POLICY.md`](../governance/RELEASE_POLICY.md)
- [`docs/governance/RELEASE_CHECKLIST.md`](../governance/RELEASE_CHECKLIST.md)
