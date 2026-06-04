# PR Merge Gate Status Helper

- Lane: `cool-ideas`
- Legend: `RUNTIME`

## Why now

The end of PR #467 was technically calm but operationally noisy: checks were
green, review threads were closed, CodeRabbit approved, and yet the PR still
was not merge-ready because the approval count and GitHub review state needed a
separate manual read. That merge gate accounting is real operator work, but
today it is spread across `gh pr checks`, `gh pr view`, and thread-aware review
queries.

## Hill

A maintainer can run one local helper and see the real merge blockers for a PR:
checks, approvals, unresolved threads, bot verdict, and the specific reason the
PR is still merge-gated.

## Done looks like

- one command or script emits a short human-readable merge-gate summary
- the same surface can emit machine-readable JSON for agents and automation
- unresolved threads, review counts, and check families are shown together
- the output distinguishes code blockers from process blockers cleanly
- the helper remains local-first and does not guess at branch-protection policy

## Repo Evidence

- `AGENTS.md`
- `docs/method/guide.md`
- `docs/method/backlog/inbox/RUNTIME_gh-447-tooling-gh-add-a-deterministic-pr-review-thread-helper-for.md`
- `docs/invariants/local-first-operation.md`

## Related Carry-Over

- `#447`
