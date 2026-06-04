# PLATFORM_git-touching-tests-docker-cutover

## Why

Wesley now carries the invariant that any test touching real Git must run in a
hermetic Dockerized lane.

The current audit shows Holmes tests and other Git-touching suites still run on
the host, which is how hook-inherited Git environment was able to contaminate a
real branch.

## Done when

- every test that shells out to `git` is classified into the Docker lane
- the Docker lane uses copy-in isolation and does not expose the host repo's
  `.git`, hooks, remotes, or inherited `GIT_*`
- the Docker lane obliterates remotes before tests run unless a suite
  intentionally creates a local fixture remote
- hook-driven sanity runs dispatch those suites into Docker instead of running
  them on the host
- tests that do not truly need real Git are downgraded to fake-port/native
  tests rather than being containerized by default

## Evidence

- [git-touching-tests-are-dockerized](../../../../invariants/git-touching-tests-are-dockerized.md)
- [dockerized-git-tests-copy-in-and-strip-remotes](../../../../invariants/dockerized-git-tests-copy-in-and-strip-remotes.md)
- [2026-04-17 git-port-plumbing-boundary audit](../../../../audit/2026-04-17-git-port-plumbing-boundary-audit.md)
