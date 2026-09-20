<!-- markdownlint-disable MD041 -->

## Linked issue

Closes #

<!-- `Closes #N` if this resolves the issue. `Refs #N` if it only advances it, with what remains. -->

## Kind of change

<!-- Exactly one. The test diff must match it: docs/testing-standard.md, rule 3. -->

- [ ] Refactoring: no test and no golden file changes
- [ ] New feature: adds tests, edits none
- [ ] Bug fix: adds a test that was observed red on the unfixed code
- [ ] Behavior change: the only kind that edits an existing expectation

## Problem

## Invariant affected

## Approach

## Alternatives rejected

## Failure modes

## Tests added

<!-- For each new load-bearing assertion: how was it shown able to fail? What is its oracle? -->

## Format and API compatibility

<!-- The IR, a hash, a wire format, the CLI's output, a public Rust API. "None" is an answer. -->

## Determinism implications

## Security implications

## Checklist

- [ ] One purpose, and small enough to review rigorously
- [ ] `cargo xtask preflight` passes
- [ ] `cargo xtask legacy-preflight` passes, if `packages/` or the lockfile changed
- [ ] No file over a limit in `docs/rust-standard.md` grew, and no ledger count rose
- [ ] The page that describes changed behavior is updated, and `CHANGELOG.md` has an entry
- [ ] No widened permissions or secrets in workflows
- [ ] Follow-on work is filed as issues

Merged with a merge commit. No rebase, no squash.
