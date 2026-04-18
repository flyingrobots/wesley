# git-touching-tests-are-dockerized

## Invariant statement

Any Wesley test that touches real Git must run in a hermetic Dockerized lane.
If a test shells out to `git`, creates a repository, clones a repository,
creates a worktree, fetches refs, or mutates refs, it must not run directly on
the host checkout.

## Preserved when

- tests that only need Git semantics use a fake `GitPort` and stay native
- tests that still need real Git run inside a copy-in container lane with no
  access to the host repo's `.git`, hooks, remotes, or inherited `GIT_*`
  environment
- hook-driven sanity suites dispatch Git-touching test packages through the
  Dockerized lane instead of invoking them directly on the host
- fixture repos created by tests exist only inside the container filesystem

## Violated when

- a host-run test shells out to `git`
- a host-run test initializes, clones, or mutates a repository under `/tmp` or
  any other local path
- Git-touching tests share the host checkout, host `.git`, or inherited Git
  environment with the suite runner
- hook or CI entrypoints run Git-touching tests directly on the host as a
  convenience shortcut

## How to check

- inventory Git-touching tests and require every one of them to run through a
  Dockerized harness
- reject new tests that call real `git` on the host unless they are first
  reclassified into the hermetic lane
- verify the Docker harness uses copy-in isolation rather than bind-mounting
  the host repo or forwarding `GIT_*`
- keep pure fake-port/unit tests native so the Docker boundary stays
  meaningful, not ceremonial
