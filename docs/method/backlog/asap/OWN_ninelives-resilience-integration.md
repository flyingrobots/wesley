# OWN: Integrate Nine Lives for Core Resilience

- Lane: `asap`
- Legend: `OWN`

## Why

Wesley Core needs a robust, self-healing execution model for both the Rust kernel and the WASM capability runtime. Using `ninelives` allows us to express retry policies, timeouts, and circuit breakers algebraically, ensuring the compiler doesn't just crash on transient or recoverable failures.

## Done looks like

- `ninelives` is added as a dependency to `wesley-core`.
- The `LoweringEngine` uses `ninelives` policies for CST traversal and IR construction.
- The WASM host (future Phase 4) uses `ninelives` for capability execution boundaries.

## Repo Evidence

- `crates/wesley-core/Cargo.toml`
- `crates/wesley-core/src/lib.rs`
