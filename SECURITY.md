# Security

## Reporting a vulnerability

Email <security@flyingrobots.dev>. Please do not open a public issue for a
vulnerability.

Include what you found, how to reproduce it, the version or commit, and what an
attacker could do with it. You will get an acknowledgement, and a fix or a
decision will be coordinated with you before anything is made public.

## Supported versions

Wesley is pre-1.0. Security fixes are made on `main` and released as the next
version. Older versions are not patched.

## What Wesley does with its input

Wesley reads GraphQL SDL, law files, and project manifests from paths you give
it, and writes generated source to a path you give it. It does not execute the
schema, fetch anything over the network, or run the code it generates. Treat
generated code as you would any code you did not write: review it before you
ship it.

## How the repository is checked

- `cargo audit` runs inside `cargo xtask release-guard`, so a release cannot be
  tagged or published with a known advisory in the dependency tree.
- Dependency Review fails a pull request that adds a dependency with a known
  vulnerability of high severity or worse.
- CodeQL and OpenSSF Scorecard run on `main` and on a schedule.
- Workflow actions are pinned to commit SHAs.
