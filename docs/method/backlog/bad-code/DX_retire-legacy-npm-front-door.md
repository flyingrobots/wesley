# Retire Legacy NPM Front Door

- Lane: `bad-code`
- Legend: `DX`

## Why now

Wesley now has a native Rust workspace and a Rust `wesley` binary for the first
footprint-honesty linter surface. The historical `pnpm wesley` entry point
still exists for older package tooling, but it is no longer the right product
center for Wesley's compiler kernel.

The current repo also creates two-brain confusion: Rust Wesley and Node Wesley
can look like competing products. The intended direction is one compiler brain
in `crates/wesley-core`, one native command body in `crates/wesley-cli`, and
legacy Node support surfaces under `packages/` only while their useful
capabilities are ported, extracted, or retired.

## Hill

The repository presents one Rust-native front door for core compiler work, and
the remaining npm package surfaces are clearly marked as legacy, tooling-only,
or scheduled for extraction.

## Done looks like

- root setup and contributor docs prefer `cargo` for Wesley core work
- CI has a Rust workspace lane that does not depend on invoking `pnpm wesley`
- package metadata no longer implies the npm host is Wesley's primary command
  surface
- legacy JS commands have an explicit extraction or retirement map
- docs command drift checks stop treating `pnpm wesley` as the front-door
  authority
- `cargo xtask legacy-preflight` is no longer needed for ordinary repo health
  checks

## Repo Evidence

- `Cargo.toml`
- `.cargo/config.toml`
- `xtask/src/main.rs`
- `crates/wesley-cli/Cargo.toml`
- `crates/wesley-cli/src/main.rs`
- `docs/ENTRYPOINTS.md`
- `package.json`
- `scripts/check-doc-cli-commands.mjs`
