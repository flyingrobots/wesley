# Wesley v0.0.6 Verification

## Status

Pending release finalization.

This file is reserved for the final guard, versioning, tag, publish, and
registry evidence gathered when v0.0.6 is actually cut. The release-proof PR
must not fill this with guessed evidence.

## Current Pre-Release Evidence

The release packet currently requires these checks before finalization:

- `pnpm fixtures:ir`
- `pnpm parity:ir`
- `pnpm parity:ir -- --fixture test/fixtures/ir-parity/nested-list-schema.graphql --projection js-sdl-type-family-vs-rust-l1-type-family.v0 --json`
- `pnpm parity:parser`
- `pnpm perf:ir -- --list-fixtures`
- `pnpm perf:bindings -- --fixture test/fixtures/ir-parity/small-schema.graphql --iterations 1 --warmups 0 --json`
- `node --test packages/wesley-cli/test/module-loading.test.mjs`
- `cargo test -p wesley-core`
- `cargo test -p wesley-cli`
- `cargo xtask preflight`
- `pnpm run lint`
- `pnpm run format:check`
- `git diff --check`

```bash
pnpm perf:ir -- --include-legacy-js --fixture test/fixtures/ir-parity/small-schema.graphql --iterations 1 --warmups 0
BATS_LIB_PATH=packages/wesley-cli/test bats -t test/ir-parity-sentinel.bats test/ir-performance-baseline.bats
```
