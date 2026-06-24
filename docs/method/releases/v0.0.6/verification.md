# Wesley v0.0.6 Verification

## Status

Superseded by [Wesley v0.1.0](../v0.1.0/release.md).

This file is retained as planning context. Do not use it as an active release
gate, and do not fill it with guessed tag, publish, or registry evidence.

## Current Pre-Release Evidence

The release packet currently requires these checks before finalization:

- `pnpm fixtures:ir`
- `cargo test -p wesley-core`
- `cargo test -p wesley-cli`
- `cargo xtask preflight`
- `pnpm perf:ir -- --list-fixtures`
- `pnpm perf:bindings -- --fixture test/fixtures/ir-parity/small-schema.graphql --iterations 1 --warmups 0 --json`
- `pnpm run lint`
- `pnpm run format:check`
- `git diff --check`

Archived migration-only evidence may still be captured while legacy lowerer
files remain, but it is not a product release gate:

```bash
pnpm parity:ir
pnpm parity:parser
pnpm perf:ir -- --include-legacy-js --fixture test/fixtures/ir-parity/small-schema.graphql --iterations 1 --warmups 0
BATS_LIB_PATH=packages/wesley-cli/test bats -t test/ir-parity-sentinel.bats test/ir-performance-baseline.bats
```
