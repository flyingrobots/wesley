# SOURCE: Wesley core-rs Parity Sentinel

- Lane: `asap`
- Legend: `SOURCE`

## Why (Cool Idea)

As we move the compiler truth to Rust, we risk "Semantic Drift" where the legacy JS implementation and the new Rust kernel produce slightly different IR or hashes for the same SDL. 

## Done looks like

- A GitHub Action or pre-push hook that runs both JS and Rust lowerers.
- It compares the resulting IR and hashes for the entire `test/fixtures/ir-parity` corpus.
- It fails if they diverge, forcing the developer to either fix the drift or explicitly update the truth manifest.

## Repo Evidence

- `scripts/generate-ir-fixtures.mjs`
- `crates/wesley-core/tests/ir_parity.rs`
