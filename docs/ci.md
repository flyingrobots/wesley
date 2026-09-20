# CI

What runs on a pull request, what runs on `main`, and how to run the same things
locally. The workflows are in `.github/workflows/`; this page names them by
their file.

## The one command

```bash
cargo xtask preflight
```

It runs, in order: `cargo fmt --check`, `cargo clippy --workspace --all-targets
-- -D warnings`, the documentation checks, `cargo test --workspace`,
`cargo xtask lean-core-check`, `cargo xtask holmes-domain-check`, a smoke run of
the CLI, and `cargo xtask docs-replay`, which replays the documented sessions.
It needs Node for that last step. If it passes locally, the Rust checks will
pass in CI. Run it before opening a pull request.

`holmes-domain-check` builds `wesley-holmes-domain` for `thumbv7em-none-eabihf`,
a target with no `std`, which is how the domain's no-I/O rule is enforced. It
needs that target: `rustup target add thumbv7em-none-eabihf`. Without it the
check says it did not run and preflight carries on; in CI (`CI=true`) a missing
target fails the run, and the workflows install it.

## On a pull request

| Workflow                      | What it runs                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `rust-native.yml`             | `cargo xtask preflight`                                                        |
| `ci.yml`                      | `pnpm -w test`, a CLI smoke run, and every bats suite under `test/*.bats`      |
| `preflight.yml`               | `pnpm run legacy-preflight`: ESLint, actionlint, links, package policy, bounds |
| `architecture-boundaries.yml` | Import boundaries of the Node package, and that retired packages stay retired  |
| `docs-link-check.yml`         | Relative links in Markdown resolve                                             |
| `pkg-holmes.yml`              | `pnpm --filter @wesley/holmes test`                                            |
| `wesley-holmes.yml`           | The Holmes assurance run over the schema sets a change touches                 |
| `dependency-review.yml`       | Fails on a new dependency with a known vulnerability of high severity or worse |
| `codeql.yml`                  | CodeQL static analysis                                                         |

`ci.yml` discovers bats suites by glob, so a new `test/<name>.bats` runs without
editing the workflow. A glob that matches nothing fails the step.

## On `main` only

| Workflow              | What it does                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `cert-shipme.yml`     | Produces a SHIPME certificate, only for a push that touches `packages/`, `.github/`, or the fixture script |
| `release-autotag.yml` | Tags the commit if it is the merge of a `release/vX.Y.Z` pull request                                      |
| `scorecards.yml`      | OpenSSF Scorecard, also on a schedule                                                                      |

`release-crates.yml` runs from a release tag. [RELEASE.md](../RELEASE.md)
describes it and the autotag workflow.

## Tests

A test executes something and checks what happened. Tests do not search
documentation, workflow files, or source code for strings.

- Rust: `cargo test --workspace`. `cargo xtask preflight` runs it.
- Node: `pnpm -w test`.
- bats: the suites under `test/` run the CLI, the fixture generators, and the
  static file server, and check their output. To run them all:

  ```bash
  pnpm run setup:bats-plugins
  for f in test/*.bats; do BATS_LIB_PATH=test/vendor bats "$f"; done
  ```

  `bats` itself is a prerequisite: `brew install bats-core`, or
  `apt install bats`. `setup:bats-plugins` only verifies the assertion plugins
  vendored under `test/vendor`; it does not install the runner.

The documentation is checked only by executing things:

- Links are followed and must resolve: `cargo xtask docs-check`.
- The sessions in `README.md` and `docs/getting-started.md` are replayed in a
  scratch directory against the built CLI: `cargo xtask docs-replay`, which
  preflight runs, and `test/docs-examples.bats` in CI. What the
  CLI prints, and the files it writes, are compared with what the page shows.
  Every `wesley` command a page names, and every option written directly after
  `wesley`, must be one that `wesley --help` lists: in a block that is run, in
  one that is not, and in an inline code span in the prose. Each page must
  contribute: a page with nothing run or nothing compared fails, and the replay
  prints how many commands it ran, outputs it compared, and names it checked.
- `docs/cli.md` must equal what the binary's help prints today, for every
  command family the root help lists; the same suite checks it.

The replay reads these annotations from the Markdown:

| Annotation                     | Before             | Meaning                                               |
| ------------------------------ | ------------------ | ----------------------------------------------------- |
| `<!-- file: NAME -->`          | any fenced block   | write the block to `NAME`                             |
| `<!-- exit: N -->`             | a `bash` block     | its commands exit `N`                                 |
| `<!-- norun: WHY -->`          | a `bash` block     | shown, not run; its command names are still checked   |
| `<!-- shows: NAME -->`         | a block not `bash` | a contiguous excerpt of `NAME`, which a command wrote |
| `<!-- stdout: json-subset -->` | a `json` block     | every key and value shown is in the real output       |

A block takes one annotation, so none can switch another's check off. `shows`
accepts only a file that a replayed command created or changed: a fixture the
page wrote itself with `file` proves nothing about a command. A `file` block is
only a fixture: whatever its language, it is never run and never compared.

A `text` block directly after a `bash` block is that block's exact output. A
stream the page does not show must be empty: a command that prints a warning the
page omits fails the replay.

The replay fails closed. Each of these is a failure, not something it skips:

- an annotation it does not know, one written without its colon, one given
  twice, one not directly before a block, two on one block, or `norun` or `exit`
  on a block with no `wesley` command;
- a fence left open, or a `wesley` line that would not run: indented, behind a
  wrapper such as `env` or `FOO=1`, or in an `sh`, `shell` or `console` fence,
  since only `bash` fences are replayed;
- in a command that is run: a pipe, redirect, quote or other shell syntax, since
  no shell interprets it, and an argument that is an absolute path or climbs
  out with `..`;
- an output block with no command before it, a comparison that compares nothing,
  and a JSON block that repeats a key, since only the last would be compared;
- a `file` or `shows` path outside the scratch directory;
- a command that does not finish within ten seconds (`--timeout-ms` changes the
  wait).

`test/docs-replay-refusals.bats` gives it one broken page per rule and requires
each to be refused with a message that names the problem.

The scratch directory is a working directory, not a sandbox. Refusing path
arguments that leave it stops a documented command from writing into the
checkout; it does not contain a command that finds a path some other way.

Prettier does not reformat code inside Markdown here, because an excerpt has to
stay byte for byte what the tool printed.

## Git hooks

`scripts/install-hooks.sh` points Git at `.githooks/`. The pre-commit hook keeps
the lockfile in step with manifest changes.

The pre-push hook chooses what to run from the paths a push changes
(`scripts/pre-push-sanity.mjs`). Rust, workflow, hook, and documentation paths
select `cargo xtask preflight`. `packages/`, the lockfile, and the package
manifests select the legacy preflight. `.github/`, `.githooks/`, `scripts/`,
`test/`, `docs/`, and `README.md` select the bats suites. A push that touches none of a group's paths
skips that group, so the hook is a shortcut, not the gate: CI runs everything.

## Toolchain

Rust stable; the repository is developed on 1.96. Node `^22.13`, `^24`, or
`>=26`, with `pnpm` at the version `package.json` names in `packageManager`.
Corepack provides it: `corepack enable`.

`actionlint` is optional locally (`brew install actionlint`, or
`go install github.com/rhysd/actionlint/cmd/actionlint@latest`). Without it,
`legacy-preflight` says the workflows were not linted and carries on. In CI
(`CI=true`) a missing `actionlint` fails the run, so a workflow is never merged
unlinted.

The gate runs `actionlint -shellcheck= -pyflakes=`. Left alone, actionlint runs
whatever `shellcheck` and `pyflakes` are on the machine, so the same workflow
could pass on a laptop and fail on a runner, or start failing when the runner
image upgrades. With them off the verdict is the same everywhere. The cost is
that the shell inside `run:` blocks is not linted by this gate.
