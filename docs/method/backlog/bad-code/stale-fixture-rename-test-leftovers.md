<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# Stale `hot-text-runtime` fixture refs break crate tests after the rope rename

Status: bad code.

## Where

The Phase 1 rename
(`refactor(fixtures): update jedit-rope.graphql consumer-model fixture`,
commit `2d6630ac`) renamed
`test/fixtures/consumer-models/jedit-hot-text-runtime.graphql` to
`jedit-rope.graphql` but left stale references in:

- `crates/wesley-emit-typescript/src/lib.rs` (`include_str!`, plus
  `createdAtTickId` field-name assertions)
- `crates/wesley-emit-rust/src/lib.rs`
- `crates/wesley-cli/tests/cli.rs`
- `crates/wesley-core/tests/operation_analysis.rs`

## Symptom

`cargo test -p wesley-emit-typescript` (or any of the above crates)
fails to compile the test target with:

```
error: couldn't read `.../jedit-hot-text-runtime.graphql`:
No such file or directory
```

The library itself builds fine — only the test target is broken. That
means `cargo build` and the CLI binary work; the breakage is invisible
unless someone runs the crate-scoped test command.

## Why it matters

This blocked unit tests for new code added during the 0024 LE binary
codec TS emitter work (2026-05-28). The workaround was to skip the
unit-test target and verify via the wesley-cli end-to-end CLI
invocation against the real schema. That works, but the unit tests
should run.

It's also potentially a CI surprise: depending on which jobs run
which `cargo test -p ...` invocations, this may or may not be caught.

## Suggested fix

Trivial mechanical update:

1. Change `include_str!` paths from
   `jedit-hot-text-runtime.graphql` to `jedit-rope.graphql`
2. Update the assertion strings that reference `createdAtTickId` to
   `createdAtRopeRewriteId` (and similar Tick → RopeRewrite renames
   that happened in jedit's Phase 1)
3. Possibly delete tests that asserted on now-removed Tick-prefixed
   types

## Why I didn't fix this in the 0024 work

The CLAUDE.md global rule says "fix errors and warnings" but also "do
not silently fix pre-existing Git violations" — this is in the
ambiguous middle. I chose to flag rather than fix because (a) it's
unrelated to LE binary codec scope, (b) the assertion updates require
knowing the post-rename intent for each field, and (c) the unit tests
in `le_binary.rs` that I wrote are still gated by this breakage.

## Surface when

Anyone runs `cargo test -p wesley-emit-typescript` (or the other four
crates) and gets a compile error. That's the moment.
