# dockerized-git-tests-copy-in-and-strip-remotes

## Invariant statement

Any Dockerized Wesley test lane that touches Git must stage its test workspace
by copy-in, and then obliterate Git remotes before running tests. Hermetic
Git-touching tests must never execute against a bind-mounted host checkout, a
mounted host `.git`, or a copied repo that still points at real remotes.

## Preserved when

- the Docker harness copies source into a container-local workspace rather than
  bind-mounting the host repo
- the harness either omits `.git` entirely or initializes a fresh container-local
  repo for the specific fixture under test
- if a copied `.git` exists for fixture realism, the harness removes all remotes
  before any test process starts
- the harness also strips inherited `GIT_*` environment so repo identity is
  container-local and explicit

## Violated when

- a Docker test lane bind-mounts the host repo or host `.git`
- a copied test workspace still has `origin` or any other real remote attached
- containerized tests can accidentally fetch, push, or resolve refs against a
  real upstream
- the Docker lane relies on host repo config, hook config, or remote config as
  a convenience shortcut

## How to check

- inspect Docker test harnesses and require copy-in isolation instead of
  bind-mounts for Git-touching suites
- require an explicit remote-scrub step before tests run
- verify that `git remote` inside the test container is empty unless a test
  intentionally creates a local fixture remote
- reject new Docker Git test harnesses that preserve host remotes or mounted
  host repository identity
