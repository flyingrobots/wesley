# Releasing

A release is a version bump merged through a pull request, a tag made by a
workflow, and a publish job started by a maintainer. This page is the whole
procedure.

Tags are immutable. A release that turns out to be wrong is fixed by releasing
the next version, never by moving a tag.

## What gets released

Five crates, published to crates.io in dependency order: `wesley-core`,
`wesley-emit-codec`, `wesley-emit-rust`, `wesley-emit-typescript`,
`wesley-cli`. They share one version and pin each other exactly (`=X.Y.Z`).
`wesley-holmes` and the root `package.json` carry the same version but are not
published.

A version with a hyphen (`0.3.0-alpha.2`) is a pre-release. It is published to
crates.io, where it must be asked for by exact version, and its GitHub Release
is marked as a pre-release and not as `latest`.

## 1. Prepare

On a branch named `release/vX.Y.Z`:

1. Set the version in the six crate manifests and in `package.json`. Set every
   sibling requirement to `=X.Y.Z`. Then run `cargo check`, which rewrites the
   workspace entries in `Cargo.lock`.
2. Refresh the pages that quote the version. `wesley doctor` prints it, and CI
   replays the documented sessions, so a bump that skips this fails the build:

   ```bash
   cargo build --bin wesley
   node scripts/generate-cli-reference.mjs --wesley target/debug/wesley
   cargo xtask docs-replay
   ```

   The last command reports each place `docs/getting-started.md` or the
   README disagrees with the binary; correct the page to match. Update the
   version in the install commands and in the crate READMEs too.

3. In `CHANGELOG.md`, move the entries under `## [Unreleased]` into a new
   `## [X.Y.Z] - YYYY-MM-DD` section. Use the UTC date. The publish workflow
   copies this section into the GitHub Release, so it is the release notes.
4. Run the checks:

   ```bash
   cargo xtask release-prep-guard --version X.Y.Z
   cargo xtask release-check
   ```

   `release-prep-guard` checks the versions, the sibling pins, the changelog
   section, that no open GitHub issue mentions the version, and, for each of the
   five crates, that the package would include `Cargo.toml`, `README.md`, and
   `src/lib.rs` or `src/main.rs`. That is a minimum: it does not reject a file
   that should not be there, so read `cargo package --list` yourself if a crate's
   contents changed.
   `release-check` runs the full preflight, builds the optimized CLI and runs
   it, and packages `wesley-core`.

   Only `wesley-core` is packaged before the tag. The other four pin siblings at
   the new version, which is not on crates.io yet, so `cargo package` cannot
   resolve them until the publish job has uploaded the crates they depend on. A
   packaging failure in an emitter or the CLI would therefore surface during
   publishing, after the tag exists, and would be fixed by releasing the next
   version.

5. Open a pull request whose title names the tag, for example
   `chore(release): prepare vX.Y.Z`. The autotag workflow requires the branch
   name, the title, and the manifest version to agree.

## 2. Merge

Merging the pull request is the decision to release. It starts
`release-autotag.yml` on the merge commit, which:

1. waits for the commit's other CI runs to finish,
2. runs `release-prep-guard` and `release-check`,
3. creates the annotated tag `vX.Y.Z` locally and runs
   `cargo xtask release-guard --tag vX.Y.Z` against it,
4. pushes the tag, unless `main` had already moved past the release commit.

The tag is unsigned. Its provenance is the workflow run that created it.

If the run fails, check first whether the tag exists:
`git ls-remote --tags origin vX.Y.Z`. A run that is cancelled after the push
reports failure although the tag was made. If the tag exists and points at the
release commit, continue. If it does not, nothing was released: fix the cause
through a new pull request. If `main` moved before the push, do not tag either
commit by hand; prepare the release again.

## 3. Publish

A tag pushed by a workflow does not start other workflows, so start the publish
job yourself:

```bash
gh workflow run release-crates.yml --ref vX.Y.Z
```

It runs `release-guard` again, creates a draft GitHub Release from the changelog
section, publishes the five crates, and then finalizes the Release. It refuses
to run from anything but a tag.

The job needs the `CARGO_REGISTRY_TOKEN` secret: a crates.io token, owned by an
owner of the crates, with the `publish-update` scope. If crates.io rejects the
token the job stops at the first upload with nothing published. Replace the
secret and re-run the failed job; the tag does not change.

```bash
gh secret set CARGO_REGISTRY_TOKEN --repo flyingrobots/wesley
```

Run that in a terminal, where it prompts for the value. Without a terminal it
reads standard input, and an empty standard input stores an empty secret.

## 4. Verify

Ask the registry, not a checkout. Inside this repository `cargo info` reports
the local crate unless told otherwise:

```bash
for crate in wesley-core wesley-emit-codec wesley-emit-rust wesley-emit-typescript wesley-cli; do
  cargo info "${crate}@X.Y.Z" --registry crates-io
done
gh release view vX.Y.Z
```

## If autotag cannot run

Only when the workflow itself is unavailable, and never to get around a check
that failed: on `main`, synced with `origin/main`, at the release commit,

```bash
cargo install cargo-audit --locked
cargo xtask release-prep-guard --version X.Y.Z
cargo xtask release-check
git tag -s vX.Y.Z -m "release: vX.Y.Z"
cargo xtask release-guard --tag vX.Y.Z
git push origin vX.Y.Z
```

`release-guard` runs `cargo audit`, which is not part of a Rust installation;
the workflow installs it, and by hand you must. Install it first, so that the
guard cannot fail for that reason after the tag already exists. If the guard
does fail, delete the local tag (`git tag -d vX.Y.Z`) before anything else: it
has not been pushed.

A tag pushed by a person starts `release-crates.yml` by itself. Do not dispatch
it as well.
