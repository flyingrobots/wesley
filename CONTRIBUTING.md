# Contributing

## Before you start

Every pull request names a GitHub issue. If there is no issue for the change,
open one first; it is where the problem and the chosen approach are agreed.

- Use `Closes #123` for an issue the pull request fully resolves, so that merging
  closes it.
- Use `Refs #123` for one it only advances, and say what remains.

Issues carry either a `triage:*` label, for work that is not scheduled, or a
`vX.Y.Z` label, for work scheduled into a release.

## Set up

```bash
git clone https://github.com/flyingrobots/wesley
cd wesley
corepack enable
pnpm install --frozen-lockfile
bash scripts/install-hooks.sh
```

You need stable Rust; Node `^22.13.0`, `^24.0.0`, or `>=26.0.0`, the range
`package.json` declares; and `bats` (`brew install bats-core` or
`apt install bats`) to run the shell suites. `pnpm` comes from Corepack at the
version `package.json` names.

## Make the change

Two standards bind every change: the [Rust standard](docs/rust-standard.md) and
the [testing standard](docs/testing-standard.md). Read them before your first
pull request. Both carry a ledger of where the existing code falls short; new
and changed code is held to them in full.

Write the test first and watch it fail for the reason you expect.

A test executes something and checks what happened. Do not add a test that
searches documentation, a workflow file, or source code for a string: it breaks
when someone rewords a sentence and proves nothing about behavior.

Then run the gate:

```bash
cargo xtask preflight
```

That is formatting, clippy with warnings denied, the documentation checks, the
workspace tests, the lean-core check, and a CLI smoke run. A change to the Node
package or the lockfile also needs `cargo xtask legacy-preflight`. [CI](docs/ci.md)
lists everything that runs on a pull request.

## Commits and history

- Use conventional commit messages: `fix(core): ...`, `feat(cli): ...`,
  `docs: ...`.
- Say what was wrong and how you know it is fixed. "Tests pass" is not evidence;
  the failing test that now passes is.
- Never amend, rebase, squash, or force-push. Fix a mistake with a new commit.
- Do not push to `main`. Changes land through pull requests, merged with a merge
  commit.

## Documentation

Documentation describes; no check reads its prose. What can be executed is:
links must resolve, and the sessions the docs show are replayed against the real
CLI, with its output and the files it writes compared to the page.

When behavior changes, change the page that describes it in the same pull
request, and add an entry under `## [Unreleased]` in `CHANGELOG.md`. Take every
claim from the code or from real command output. `docs/cli.md` is generated from
`wesley --help`; regenerate it, do not edit it:

```bash
cargo build --bin wesley
node scripts/generate-cli-reference.mjs --wesley target/debug/wesley
```

The sessions in the README and the getting-started guide are replayed in CI, so
an example that stops being true fails the build. [CI](docs/ci.md) describes
the annotations the replay reads.

## Dependencies

Wesley is Apache-2.0. A new dependency must be compatible with that, maintained,
and worth what it brings into the tree. `wesley-core` with default features off
must stay free of an async runtime; `cargo xtask lean-core-check` enforces it.

## Releases

See [RELEASE.md](RELEASE.md).
