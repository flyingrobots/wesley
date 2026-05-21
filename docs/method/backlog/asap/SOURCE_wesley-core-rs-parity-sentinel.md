# SOURCE: Wesley core-rs Parity Sentinel

- Lane: `asap`
- Legend: `SOURCE`

## Why (Cool Idea)

As we move the compiler truth to Rust, we risk "Semantic Drift" where the
legacy JS implementation and the new Rust kernel produce slightly different IR
or hashes for the same SDL.

## Done looks like

- `pnpm fixtures:ir` remains the Rust L1 golden-regeneration command only.
- A separate GitHub Action or pre-push hook runs the legacy JS lowerer and
  Rust lowerer against an explicit parity corpus.
- The sentinel normalizes agreed non-semantic envelope fields before comparing
  semantic IR and hashes.
- It fails if JS and Rust diverge, forcing the developer to fix drift, update
  the Rust L1 truth manifest, or record an explicit compatibility break.

## Repo Evidence

- `scripts/generate-ir-fixtures.mjs`
- `docs/design/0009-rust-core-and-wasm-capability-abi/phase-0-ir-truth-manifest.md`
- `packages/wesley-runtime-node/src/GraphQLAdapter.mjs`
- `crates/wesley-core/tests/lowering_validation.rs`
