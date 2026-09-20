# AGENTS

Operating rules for AI agents, and for people recovering context, in this
repository.

## Git

- Never amend, rebase, squash, or force-push. Fix a mistake with a new commit.
- Never push to `main` without explicit permission. Changes land through pull
  requests, merged with a merge commit.
- Every pull request names a GitHub issue: `Closes #123` if it resolves the
  issue, `Refs #123` if it only advances it, with what remains.

## Binding standards

Read both in full before writing, reviewing, or configuring anything:

- [docs/rust-standard.md](docs/rust-standard.md): every Rust file, manifest,
  lockfile, and lint or toolchain configuration.
- [docs/testing-standard.md](docs/testing-standard.md): every automated
  assertion.

Each ends with a compliance ledger and a ratchet. Existing violations may only
shrink; new code complies from its first commit.

## Where the truth is

- **Behavior:** the code, and `wesley --help`. `docs/cli.md` is generated from
  the latter.
- **How the parts fit:** [docs/architecture.md](docs/architecture.md).
- **What runs in CI and how to run it locally:** [docs/ci.md](docs/ci.md).
- **How a release is made:** [RELEASE.md](RELEASE.md).
- **What changed and when:** [CHANGELOG.md](CHANGELOG.md) and `git log`.
- **Pending work:** GitHub issues. `triage:*` labels mark unscheduled work;
  `vX.Y.Z` labels mark work scheduled into a release.

There is no design archive in the tree. Git is the archive.

## Recovering context

1. `git status` and `git log -n 10`.
2. The open issues and pull requests.
3. The pages above, as far as the task needs.

## Working

- Write the test first and watch it fail for the reason you expect.
- A test executes something and checks what happened. Never add a test that
  searches documentation, a workflow file, or source code for a string.
- Documentation is not tested. When behavior changes, change the page that
  describes it in the same pull request, taking every claim from the code or
  from real command output, and add a `CHANGELOG.md` entry.
- Before saying a check passed, find out what it looked at. Verify a publish
  against the registry, not from inside this checkout.

## Before you finish

1. `cargo xtask preflight`, and `cargo xtask legacy-preflight` if the Node
   package or the lockfile changed.
2. Follow-on work is filed as issues, not left in comments.
3. Commit with a conventional message that says what was wrong and how you know
   it is fixed.
