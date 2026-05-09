# OWN: Refactor Lowerer to Optic Engine

- Lane: `asap`
- Legend: `OWN`

## Why (Categorical Slop)

The current `ApolloLoweringAdapter` is implemented as a procedural, linear pipeline. This is a "Cold Compiler" mindset. To conform to the Continuum, Wesley must be an **Optic Engine**.

It should not "lower a string"; it should **project a reading from a coordinate**.

## Done looks like

- `LoweringPort` is replaced by `WarpOptic` trait.
- The implementation focus shifts from "Parsing SDL" to "Projecting the Semantic Chart (Level 1)".
- The internal state is managed as a recursive WARP-graph capable of DPO transformations.

## Repo Evidence

- `crates/wesley-core/src/adapters/apollo.rs`
- `crates/wesley-core/src/ports/lowering.rs`
