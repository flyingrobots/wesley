# Wesley v0.3.0-alpha.2 Release Packet

## Summary

Wesley `0.3.0-alpha.2` puts `wesley-core`'s async lowering port behind a
default-on `resilience` feature and removes two unused dependencies, so a
consumer that needs only the synchronous compiler kernel can omit the async
runtime stack.

The release is deliberately narrow: one Cargo feature, two dependency removals,
and the gate that keeps the lean build lean. It changes no IR, no hash, no CLI
behavior, and no emitted artifact.

## Included Scope

- #803: `wesley-core` forces the async runtime stack on kernel-only consumers.
  Landed in #804.
- The `resilience` feature gating `ports::lowering`, the `resilience` module,
  their re-exports, and `impl LoweringPort for ApolloLoweringAdapter`.
- Removal of the unused `tower` dependency and the unused normal `tokio`
  dependency.
- `cargo xtask lean-core-check`, wired into `cargo xtask preflight`.
- `crates/wesley-core/tests/lean_core.rs`, which runs in both configurations.

## Sponsored Users

- A downstream build-time tool that calls only `lower_schema_sdl` and
  `compute_registry_hash` to compile a GraphQL vocabulary into a generated
  descriptor. Pointed at #804 with `default-features = false`, its dependency
  tree went from 92 crates to 46, its tests passed, and the artifact it
  generates was byte-identical.

## Version Justification

A pre-release of the 0.3.0 line, not a patch to `0.2.0`: `0.3.0-alpha.1` is
already published and this builds on it. The change is additive for
default-feature consumers. The one observable difference is that
`--no-default-features` now has an effect, which a pre-release may introduce.
The stable `0.3.0` is not claimed.

## Non-Goals

- No change to the IR, the registry hash, schema diffing, or operation analysis.
- No change to the CLI or to any emitter.
- The `resilience` feature is not turned off by default. That would break
  consumers of the async port and belongs to a deliberate later decision.
- No reduction of the remaining 44 crates. Most arrive through `apollo-parser`,
  `chrono`, and `serde`.

## Acceptance

- `cargo xtask preflight` passes, including `lean-core-check`.
- `cargo test -p wesley-core --no-default-features` passes every suite.
- `cargo tree -p wesley-core --no-default-features -e normal` names none of
  `async-trait`, `ninelives`, `tokio`, or `tower`.
- `cargo xtask release-prep-guard --version 0.3.0-alpha.2` passes.
- The default-feature public API is unchanged.
