# git-port-plumbing-boundary

## Invariant statement

All Git operations in Wesley must cross a `GitPort` boundary, and every real
Git implementation behind that boundary must be backed by
`@git-stunts/plumbing`. Wesley must not shell out to `git` directly from
application code, runtime code, test helpers, or repo tooling.

## Preserved when

- features depend on a `GitPort` interface rather than calling `git`
  subprocesses directly
- the only real adapter for that port is backed by `@git-stunts/plumbing`
- tests inject fake ports or use plumbing-backed repository fixtures instead of
  bespoke `spawnSync('git', ...)` helpers
- hooks and repo scripts call shared Git adapters rather than open-coding Git
  subprocess logic

## Violated when

- any Wesley file shells out to `git` directly with `spawnSync`, `execFileSync`,
  `execSync`, or similar subprocess helpers
- a package invents its own bespoke real Git adapter instead of using
  `@git-stunts/plumbing`
- test helpers call `git -C <tmpdir> ...` directly and inherit outer Git hook
  environment
- hook, CI, or runtime boundaries pass `GIT_*` environment variables into
  nested Git subprocesses outside the shared Git adapter

## How to check

- audit the repo for direct `git` subprocess usage and require the result to be
  empty outside the sanctioned Git adapter boundary
- challenge any new Git-touching code that does not name its `GitPort`
  dependency explicitly
- verify that the real adapter path routes through `@git-stunts/plumbing`
  rather than a bespoke wrapper
- treat inherited `GIT_*` environment at hook or test boundaries as a
  correctness and safety bug, not as harmless test noise
