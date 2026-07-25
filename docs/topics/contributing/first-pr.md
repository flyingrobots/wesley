# First PR

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this page when you want one small, safe Wesley contribution without
learning the whole architecture first.

The short version: pick a scoped GitHub issue, change the named file or small
file set, run the command named in the issue, then open one PR for that issue.

## Required Reading

Read only what your issue needs:

- the issue body and acceptance criteria
- this page
- the task topic linked from the issue, if it has one
- [Validation](../validation.md) for local checks before the PR
- [Issue Triage](./triage.md) only if you are helping maintain the queue

These are useful background, not required first-hour reading:

- [Vision](../../VISION.md)
- [Architecture](../../ARCHITECTURE.md)
- [Design packets](../../design/README.md)
- assurance vocabulary such as Holmes, Watson, Moriarty, BLADE, witness
  surfaces, or realization shells

If a starter issue requires advanced vocabulary, the issue should either define
the term in plain English or stop being marked `good first issue`.

## Optional Consumer Examples

Wesley keeps some consumer-shaped fixtures so compiler changes can be tested
against realistic schema pressure without depending on sibling checkouts.
[Jedit Capability Evidence](../../JEDIT_CAPABILITY_EVIDENCE.md) is the current
example. Treat it as Wesley-side compiler evidence only: jedit, Echo, and other
consumers own their own product behavior and runtime semantics.

## Pick A Starter Issue

Use the
[good first issue query](https://github.com/flyingrobots/wesley/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)
and choose an issue that has:

- exactly one milestone, named plain `vX.Y.Z`, and no `triage:*`, retired
  `lane:*`, or concrete-version scheduling label
- no `work-in-progress` label
- one primary file or a very small file set
- one local validation command in the acceptance criteria
- plain wording in the title and summary

Leave broad design, release, assurance, or architecture issues for maintainers
unless the issue explicitly says it is scoped for a first PR.

## Fast Paths

| Path            | Typical Files                                        | Local Command                                           | Good First Shape                                      |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Docs-only PR    | `docs/topics/*.md`, `docs/guides/*.md`, `README.md`  | `cargo xtask docs-check`                                | Clarify one page, fix one route, or add one example.  |
| Fixture-only PR | `test/fixtures/**/*.graphql`, related golden fixture | Issue-named test command                                | Add one domain-free schema shape and its expectation. |
| Rust emitter PR | `crates/wesley-emit-rust/src/lib.rs`                 | `cargo test -p wesley-emit-rust` or issue command       | Add one schema case and assert generated type shape.  |
| TS emitter PR   | `crates/wesley-emit-typescript/src/lib.rs`           | `cargo test -p wesley-emit-typescript` or issue command | Add one schema case and assert generated type shape.  |
| CLI bug PR      | `crates/wesley-cli/tests/cli.rs`                     | `cargo test -p wesley-cli --test cli <filter>`          | Reproduce one command failure with a clear assertion. |

Do not start by refactoring shared architecture. A first PR should leave a
reviewer able to answer: issue, file, command, result.

## Branch And PR

1. Start from an up-to-date `main` unless a maintainer asks you to stack on
   another branch.
2. Name the branch after the issue, for example
   `docs/project-manifest-starter`.
3. Keep one issue per PR.
4. Mention the issue in the PR body with `Closes #NNN` when the PR fully
   completes it.
5. Include the exact validation command and result in the PR body.

If you cannot edit issue metadata yourself, comment on the issue that you are
taking it. A maintainer should add `work-in-progress` while the slice is active.

## Maintainer Starter-Issue Checklist

Before applying `good first issue`, make the issue executable without private
context:

- title uses ordinary terms
- summary explains the task in two or three sentences
- scope names one primary file or tiny file set
- acceptance criteria include exactly one required local command
- tracker metadata has exactly one scheduling state: either one `triage:*`
  label and no milestone, retired `lane:*`, or concrete-version scheduling
  label, or exactly one milestone, named plain `vX.Y.Z`, and no `triage:*`,
  retired `lane:*`, or concrete-version scheduling label
- starter issues are scheduled with a plain `vX.Y.Z` milestone; narrative
  release outcomes do not become additional milestones
- no advanced Wesley term appears without a plain-English alias

Useful commands:

```bash
gh issue edit <number> --add-label "good first issue"
gh issue edit <number> --remove-label triage:requests --milestone v0.3.0
gh issue edit <number> --add-label work-in-progress
gh issue edit <number> --remove-label work-in-progress
```

If an issue is too broad, split it before adding `good first issue`.

## Maintainer Release And Triage Commands

Use these only when maintaining the queue or preparing a release:

```bash
gh issue list --label triage:requests --state open
gh issue list --label "good first issue" --state open
gh issue list --milestone v0.3.0 --state open
# After the release-prep PR lands, while the release gate remains open:
cargo xtask preflight
# After that preflight passes, complete sign-off and close the gate:
cargo xtask release-prep-guard --version X.Y.Z
# After creating the signed tag locally, but before pushing it:
cargo xtask release-guard --tag vX.Y.Z
```

The full release execution layer remains
[Release Runbook](../../method/release-runbook.md). The scheduling contract
remains [Issue Triage](./triage.md).

## Related

- [Contributing](../../../CONTRIBUTING.md)
- [Plain Wesley](../plain-wesley.md)
- [Docs Orientation](../docs-orientation.md)
- [Docs Maintenance](../docs-maintenance.md)
- [Releases](../releases.md)
