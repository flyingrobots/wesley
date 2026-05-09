# PLATFORM_git-port-plumbing-cutover

## Why

Wesley now carries the invariant that all Git operations must cross a `GitPort`
boundary and be backed by `@git-stunts/plumbing`.

The 2026-04-17 audit shows the repo currently violates that invariant in
runtime code, test helpers, and repo tooling.

## Done when

- one sanctioned Wesley `GitPort` exists
- the only real adapter behind that port is backed by
  `@git-stunts/plumbing`
- Holmes no longer shells out to `git` directly
- repo tooling no longer shells out to `git` directly
- temp-repo tests use fake ports or plumbing-backed helpers rather than raw
  `spawnSync('git', ...)`
- hook and test-runner boundaries scrub inherited `GIT_*` env as defense in
  depth

## Evidence

- [git-port-plumbing-boundary](../../../invariants/git-port-plumbing-boundary.md)
- [2026-04-17 git-port-plumbing-boundary audit](../../../audit/2026-04-17-git-port-plumbing-boundary-audit.md)
