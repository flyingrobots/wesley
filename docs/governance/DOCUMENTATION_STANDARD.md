# Wesley Documentation Standard

<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley's documentation is a product interface and an evidence ledger. It is not
a live backlog, status board, or progress counter.

This standard adapts the repository documentation rules to Wesley's quirks:
compiler truth, assurance evidence, METHOD closeouts, and GitHub-owned roadmap
state.

## Canonical Work State

Live work state belongs in GitHub:

| Work State     | Canonical Surface                                                           |
| -------------- | --------------------------------------------------------------------------- |
| Raw intake     | GitHub Issue with a `triage:*` label                                        |
| Goalpost       | GitHub Milestone named `Goalpost: ...`                                      |
| Slice          | GitHub Issue assigned to one goalpost milestone                             |
| Release lane   | GitHub label named `vX.Y.Z`                                                 |
| Release target | GitHub Milestone named `Release: vX.Y.Z`                                    |
| Release gate   | GitHub Issue assigned to the release milestone                              |
| Roadmap board  | [Wesley Roadmap Project](https://github.com/users/flyingrobots/projects/18) |
| Classification | GitHub labels for triage, release lane, legend, work type, package, status  |

Repository docs may link to GitHub state. They must not mirror live counts,
unchecked work queues, velocity, burn-down, or "next issue" lists.

Because GitHub Issues can have only one milestone, release milestones must not
steal implementation issues away from their goalpost milestones. A release
milestone holds release-gate issues; those gate issues link to the goalposts
selected for that release.

## Page Jobs

Every maintained doc should have one primary job:

| Page Type         | Job                                                                     |
| ----------------- | ----------------------------------------------------------------------- |
| Tutorial          | Teach a new operator a path that works.                                 |
| How-to            | Solve one concrete task.                                                |
| Reference         | Define stable APIs, commands, schemas, flags, invariants, or contracts. |
| Explanation       | Explain why the system is shaped a certain way.                         |
| Troubleshooting   | Diagnose and recover from known failures.                               |
| Contributor guide | Explain how to change Wesley without breaking its invariants.           |
| Evidence          | Preserve proof, closeout, or audit material from completed work.        |

Do not mix a page's primary job with roadmap tracking. If the page starts
answering "how far along are we?", move that state to GitHub.

## Wesley Quirks

- `README.md` is product-facing. It should explain what Wesley is and how to
  start, not METHOD doctrine.
- `docs/BEARING.md` states direction and tensions. It must not contain slice
  ledgers, progress bars, or live release gates.
- `docs/design/` contains specifications, design packets, and durable evidence.
  It must not be used as the active queue after an issue is created.
- `docs/method/retro/`, `docs/method/graveyard/`, `docs/method/releases/`, and
  `docs/releases/` preserve closeout and release evidence after the fact.
- `CHANGELOG.md` records merged behavior. It is not a planning document.
- `docs/TECHNICAL_TEARDOWN.md` is a release-scoped orientation snapshot,
  structural audit, and risk map. It must not become a second architecture doc
  or roadmap. `docs/ARCHITECTURE.md` remains the current structural authority;
  `docs/BEARING.md` remains the current direction surface.
- Historical docs may preserve completed context, but any page that reads like
  a current tracker should be collapsed into evidence plus GitHub links.

## Examples

Examples must say what they are:

- Runnable examples should include exact commands and expected outputs when the
  output is stable.
- Illustrative examples should be marked as illustrative.
- Abridged examples should say what was omitted.
- Generated or schema-backed examples should be checked when a reasonable local
  checker exists.

Examples that contradict runtime behavior are bugs in the docs.

## Public Vocabulary

New public nouns must reduce reader load. When a page introduces a Wesley term
that is not standard GraphQL, Rust, TypeScript, CLI, GitHub, or release-process
language, do one of the following near first use:

- give it a plain-English alias,
- link to a page that defines it with a runnable or inspectable example, or
- mark it as internal or experimental vocabulary.

Beginner paths should use standard GraphQL and compiler terms before advanced
assurance/toolchain terms.

## Coverage Matrix

For each public capability, keep one obvious path to:

- orientation or explanation
- command/API/schema reference
- at least one runnable or clearly illustrative example
- troubleshooting or known failure behavior when relevant
- release or closeout evidence when the behavior shipped recently

The matrix can be implicit in signposts. It must not become a backlog. Missing
coverage should be filed as GitHub Issues and assigned to a goalpost.

## Hard Rules

- Do not add new Markdown backlog cards.
- Do not add progress bars, score tables, live slice ledgers, or unchecked
  roadmap checklists to repo docs.
- Do not let `triage:*` remain on an issue after it has been scheduled into a
  named release lane.
- Do not move implementation issues into release milestones. Link goalposts
  from release-gate issues instead.
- Do not cite chat as proof. Use code, tests, commits, PRs, releases, workflow
  runs, GitHub Issues, or durable evidence files.
- Do not create a new signpost unless it has a distinct reader job.

## Maintenance

When changing docs:

1. Identify the page job before editing.
2. Replace live progress state with GitHub links.
3. Update `docs/truth-manifest.json` when a public or governance signpost should
   be part of docs-truth checks.
4. Run docs checks before opening a PR.
5. File follow-up work as GitHub Issues instead of leaving TODOs in prose.
