# Wesley Core Rewrite (JS -> Rust)

> Current design packet:
> [Wesley Rust Core And WASM Capability ABI](./design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md).
> This note is the older seed of that direction; the design packet is the active
> architectural boundary.

**Status:** Deferred (Trojan Horse Strategy active)
**Goal:** Port `wesley-core` from JavaScript to Rust to enable a unified, high-performance compiler library that powers both Node.js (via WASM/NAPI) and native Rust tools (like Echo).

## The Vision

Currently, `wesley-core` is a Node.js package using `graphql-js` to parse schemas and generate an Intermediate Representation (IR).

The target state is a **Rust crate (`wesley-core-rs`)** that:

1.  Parses GraphQL SDL (using `async-graphql-parser` or `apollo-parser`).
2.  Applies Wesley directive logic (`@table`, `@field`, etc.).
3.  Produces the canonical Wesley IR (Structs/Enums).
4.  Exports this logic to:
    - **Cargo:** For `echo-gen` and other Rust tools.
    - **WASM/NAPI:** For the `wesley` CLI and VS Code extensions.

## The Gap Analysis

### 1. Schema Parsing

- **Current (JS):** Uses `graphql-js` `buildSchema`.
- **Target (Rust):** Use `async-graphql-parser` for its robust directive support and active maintenance.
- **Work:** Port the directive validation logic.

### 2. IR Generation

- **Current (JS):** `schemaToIR(schema) -> JSON`.
- **Target (Rust):** `schema_to_ir(&Schema) -> WesleyIR`.
- **Work:** Define the `WesleyIR` structs in Rust (deriving `Serialize` for JSON compat).

### 3. Binding Layer

- **Current:** N/A.
- **Target:** `wasm-bindgen` or `napi-rs` wrappers to expose `parse_and_generate_ir(sdl: String) -> String (JSON)`.

## The "Trojan Horse" Strategy (Current)

To unblock the `flyingrobots.dev` integration without a full rewrite:

1.  We continue using `wesley-core` (JS) to parse SDL and emit `ir.json`.
2.  We build `echo-gen` (Rust) to consume this `ir.json` and generate Rust code using `syn`/`quote`.
3.  **Future Migration:** When `wesley-core-rs` is ready, `echo-gen` simply calls the Rust library function instead of reading a JSON file. The downstream generation logic remains unchanged.

## Roadmap to Rust Core

1.  [ ] **Scaffold `crates/wesley-core`** in the Wesley repo (or move to a Rust workspace).
2.  [ ] **Define IR:** Port the JSON schema to Rust structs.
3.  [ ] **Implement Parser:** Wire up `async-graphql-parser`.
4.  [ ] **Port Directives:** Re-implement the logic for `@uid`, `@table`, relations.
5.  [ ] **Verify Parity:** Ensure `wesley-core-rs` produces identical IR to the JS version for standard schemas.
6.  [ ] **Switch CLI:** Update `wesley-host-node` to use the Rust WASM/NAPI binding.
