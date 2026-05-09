# SOURCE: Wesley SDL Normalizer Command

- Lane: `up-next`
- Legend: `SOURCE`

## Why (Cool Idea)

Wesley now performs "Semantic Consolidation" in the Rust Core (merging extensions and base types). Users often struggle to see the "Total Truth" of their schema when it is spread across multiple files or extensions.

A `normalize-sdl` command would provide a canonical, sorted, and consolidated view of the schema as the compiler sees it.

## Done looks like

- New CLI command: `wesley normalize-sdl --schema <path>`.
- It parses the SDL, performs semantic consolidation, sorts all types and fields lexicographically.
- It prints the resulting "Clean SDL" to stdout.
- This serves as a "Pre-compilation Truth Anchor" for developers.

## Repo Evidence

- `crates/wesley-core/src/adapters/apollo.rs` (Consolidation logic)
