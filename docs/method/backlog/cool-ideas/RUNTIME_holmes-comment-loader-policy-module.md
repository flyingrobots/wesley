# Holmes Comment Loader Policy Module

- Lane: `cool-ideas`
- Legend: `RUNTIME`

## Why now

The recent PR #467 review loop exposed that Holmes comment loading policy is
real logic, not just glue: artifact discovery, explicit-status handling,
diagnostic preservation, and markdown/report truth all live close together.
Today that policy is mostly embedded in `pr-comment.mjs`, with the CLI acting as
an adjacent caller rather than a clearly separate consumer of one loader
surface.

## Hill

A maintainer can inspect one small Holmes artifact-loader module, understand the
policy for report discovery and fallback behavior, and reuse it from both the
PR comment builder and the CLI without re-deriving the rules from a large file.

## Done looks like

- one focused Holmes artifact-loader/helper module owns discovery, parse, and
  diagnostic policy
- the PR comment builder consumes the helper instead of carrying low-level
  loading concerns inline
- the CLI and tests use the same helper contract
- fixture coverage proves success, missing, invalid, and unreadable-artifact
  paths without duplicated setup logic
- the module stays local-first and does not add ambient network or workflow
  assumptions

## Repo Evidence

- `packages/wesley-holmes/src/pr-comment.mjs`
- `packages/wesley-holmes/src/pr-comment-cli.mjs`
- `packages/wesley-holmes/test/pr-comment.test.mjs`
- `packages/wesley-holmes/test/fixtures/sample-reports.mjs`
- `docs/invariants/local-first-operation.md`

## Related Carry-Over

- `#466`

