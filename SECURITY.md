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

The `wesley` CLI and the Rust crates read GraphQL SDL, law files, and project
manifests from paths you give them, and write generated source to a path you
give them. They treat all of it as data: they do not execute the schema, fetch
anything over the network, or run the code they generate. Treat generated code
as you would any code you did not write: review it before you ship it.

## Holmes loads and runs code

The Node package `@wesley/holmes` is different. When one of its commands runs in
a directory that has a `wesley.config.mjs`, or one named by `WESLEY_CONFIG`, it
**imports that file and every module the file enables**. Those are executable,
trusted inputs, not data. Running Holmes in a checkout you do not trust runs
that checkout's code with your permissions.

Two environment variables control this:

- `WESLEY_MODULE_ALLOWLIST`: a list of the config and module specifiers that may
  load. Anything not listed is refused. **When it is empty or unset, everything
  is allowed.**
- `WESLEY_DISABLE_MODULES`: set to `1`, `true`, `yes`, or `on` to load no
  modules at all.

In CI, or anywhere Holmes runs over code from a pull request, set one of them.
Review a module before you add it to the allowlist as you would review any
dependency.

## How the repository is checked

- `cargo audit` runs inside `cargo xtask release-guard`, so a release cannot be
  tagged or published with a known advisory in the dependency tree.
- Dependency Review fails a pull request that adds a dependency with a known
  vulnerability of high severity or worse.
- CodeQL and OpenSSF Scorecard run on `main` and on a schedule.
- Workflow actions are pinned to commit SHAs.
