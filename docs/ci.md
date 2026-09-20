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
`cargo xtask lean-core-check`, and a smoke run of the CLI. If it passes locally,
the Rust checks will pass in CI. Run it before opening a pull request.

## On a pull request

| Workflow                      | What it runs                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `rust-native.yml`             | `cargo xtask preflight`                                                        |
| `ci.yml`                      | `pnpm -w test`, a CLI smoke run, and every bats suite under `test/*.bats`      |
| `preflight.yml`               | `pnpm run legacy-preflight`: links, package policy, dependency boundaries      |
| `architecture-boundaries.yml` | Import boundaries of the Node package, and that retired packages stay retired  |
| `docs-link-check.yml`         | Relative links in Markdown resolve                                             |
| `pkg-holmes.yml`              | `pnpm --filter @wesley/holmes test`                                            |
| `wesley-holmes.yml`           | The Holmes assurance run over the schema sets a change touches                 |
| `dependency-review.yml`       | Fails on a new dependency with a known vulnerability of high severity or worse |
| `codeql.yml`                  | CodeQL static analysis                                                         |

`ci.yml` discovers bats suites by glob, so a new `test/<name>.bats` runs without
editing the workflow. A glob that matches nothing fails the step.

## On `main` only

| Workflow              | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `cert-shipme.yml`     | Produces a SHIPME certificate for the commit that landed              |
| `release-autotag.yml` | Tags the commit if it is the merge of a `release/vX.Y.Z` pull request |
| `scorecards.yml`      | OpenSSF Scorecard, also on a schedule                                 |

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

The documentation is checked only by executing things:

- Links are followed and must resolve: `cargo xtask docs-check`.
- The sessions in `README.md` and `docs/getting-started.md` are replayed in a
  scratch directory against the built CLI: `test/docs-examples.bats`. What the
  CLI prints, and the files it writes, are compared with what the page shows.
  Every `wesley` command a page names, run or not, must be one that
  `wesley --help` lists. Each page must contribute: a page with nothing run or
  nothing compared fails.
- `docs/cli.md` must equal what the binary's help prints today, for every
  command family the root help lists; the same suite checks it.

The replay reads these annotations from the Markdown:

| Annotation                     | Before           | Meaning                                              |
| ------------------------------ | ---------------- | ---------------------------------------------------- |
| `<!-- file: NAME -->`          | any fenced block | write the block to `NAME`                            |
| `<!-- exit: N -->`             | a `bash` block   | its commands exit `N`                                |
| `<!-- norun: WHY -->`          | a `bash` block   | shown, not run; its command names are still checked  |
| `<!-- shows: NAME -->`         | any fenced block | the block is a contiguous excerpt of the file `NAME` |
| `<!-- stdout: json-subset -->` | a `json` block   | every key and value shown is in the real output      |

A `text` block directly after a `bash` block is that block's exact output.
Prettier does not reformat code inside Markdown here, because an excerpt has to
stay byte for byte what the tool printed.

## Git hooks

`scripts/install-hooks.sh` points Git at `.githooks/`. The pre-commit hook keeps
the lockfile in step with manifest changes. The pre-push hook runs the legacy
preflight and every bats suite.

## Toolchain

Rust stable; the repository is developed on 1.96. Node `^22.13`, `^24`, or
`>=26`, with `pnpm` at the version `package.json` names in `packageManager`.
Corepack provides it: `corepack enable`.
