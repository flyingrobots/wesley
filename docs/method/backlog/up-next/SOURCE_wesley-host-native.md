# SOURCE: Wesley Native Rust Host (wesley-host-native)

- Lane: `future`
- Legend: `SOURCE`

## Why (Cool Idea)

Currently, the Wesley CLI requires a Node.js runtime (`wesley-host-node`). With the core logic moving to Rust, and transmuters eventually running in WASM, we can eliminate the Node dependency entirely for end-users.

## Done looks like

- A new crate `crates/wesley-host-native` (or `wes`).
- It is a statically compiled Rust binary.
- It parses CLI arguments using `clap`.
- It executes the `wesley-core` compiler directly.
- It loads and runs transmuters via a `wasmtime` engine.
- Result: A zero-dependency, instant-boot CLI.

## Repo Evidence

- `crates/wesley-core` (The library it will wrap)
