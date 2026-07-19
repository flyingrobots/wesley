# Releases

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when preparing, reviewing, or judging a Wesley release.

Wesley releases are cut from synced `main` only. A feature branch or PR can
prepare release facts, but the tag must point at the merged `main` commit.

## Release Shape

Release state has one scheduling authority:

| Surface                                       | Purpose                                             |
| --------------------------------------------- | --------------------------------------------------- |
| GitHub milestone `vX.Y.Z`                     | Sole schedule for release work and its pre-tag gate |
| GitHub Project fields                         | Priority, workflow status, and optional grouping    |
| GitHub labels                                 | Triage and classification; never release scheduling |
| `CHANGELOG.md`                                | Historical ledger of merged behavior                |
| `.continuum/release.yml`                      | Repo-local release profile and publish facts        |
| `docs/method/releases/vX.Y.Z/release.md`      | Internal release design and scope                   |
| `docs/method/releases/vX.Y.Z/verification.md` | Repo-resident pre-tag validation witness            |
| `docs/releases/vX.Y.Z.md`                     | User-facing release notes                           |

Every scheduled issue, including the release gate, belongs to the one exact
plain `vX.Y.Z` milestone. Project fields and grouping labels may organize that
work, but they do not schedule it. The release gate is the final open issue in
the milestone: close it after every other issue is closed, moved, or cut, and
before creating the signed local tag.

Here `vX.Y.Z` means exact tag-form SemVer. Every prerelease uses its full
milestone title, such as `v0.3.0-alpha.2`.

Executable release guards query only the exact `vX.Y.Z` milestone. A missing
milestone is a hard failure, not an empty release schedule. Post-publication truth
stays with the tag workflow, finalized GitHub Release, registry records, and
direct delivery witness; it does not require a manual backfill merge.

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

The live tracker shape is deliberately small: an unscheduled issue has exactly
one `triage:*` label and no milestone; a scheduled issue has exactly one plain
`vX.Y.Z` milestone and no `triage:*` or version scheduling label. Narrative
themes are release outcomes in the release packet, not a second milestone axis.

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

After the release-prep PR lands on `main` but before closing the release gate
and creating the signed tag, run one last docs/signpost audit. The goal is not
to create a progress tracker; it is to make sure the tagged commit tells the
truth without a post-release backfill.

Check these durable surfaces at minimum:

- `README.md`
- `docs/README.md`
- `docs/GUIDE.md`
- `docs/ENTRYPOINTS.md`
- `docs/BEARING.md`
- `docs/TECHNICAL_TEARDOWN.md`
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
cargo xtask preflight
cargo xtask release-check
# After the release-prep PR lands, while the release gate remains open:
cargo xtask preflight
# After that preflight passes, complete sign-off and close the gate:
cargo xtask release-prep-guard --version X.Y.Z
# After the signed tag exists locally, but before pushing it:
cargo xtask release-guard --tag vX.Y.Z
```

Run the final `release-prep-guard` only after every issue in milestone
`vX.Y.Z`, including the release gate, is closed or moved. Close the gate before
creating the tag. Run `release-guard` only after the signed tag exists locally
and points at the synced `main` release commit, and require it to pass before
the tag is pushed. On failure, resolve remote tag state first. Only when the tag
is proven absent may the unpublished local tag be deleted and the gate reopened
for pull-request corrections. If the tag is present or remote state is
indeterminate, mutate neither tag nor gate. Never delete or recreate a remote
tag.

## Related Authority

- [`.continuum/release.yml`](../../.continuum/release.yml)
- [`docs/method/release.md`](../method/release.md)
- [`docs/method/release-runbook.md`](../method/release-runbook.md)
- [`docs/governance/RELEASE_POLICY.md`](../governance/RELEASE_POLICY.md)
- [`docs/governance/RELEASE_CHECKLIST.md`](../governance/RELEASE_CHECKLIST.md)
