# SOURCE: Wesley core-rs Parser Choice Spike

- Lane: `up-next`
- Legend: `SOURCE`

## Why (Decision)

We evaluated `apollo-parser` and `async-graphql-parser`. 

**Decision: apollo-parser**

## Rational

1. **Concrete Syntax Tree (CST):** Unlike `async-graphql-parser`, which produces a standard AST, `apollo-parser` (via `rowan`) provides a CST that preserves all source information, including trivia (whitespace, comments) and precise byte-range spans. This is essential for Wesley's high-fidelity diagnostics and future formatting/refactoring features.
2. **Error Resilience:** `apollo-parser` is designed to keep parsing even in the face of syntax errors, collecting multiple diagnostics. This matches Wesley's goal of being a robust compiler toolchain.
3. **Spec Compliance:** It is maintained by Apollo and stays extremely close to the latest GraphQL spec.
4. **Tooling First:** It is explicitly designed for building developer tools (compilers, linters), whereas `async-graphql-parser` is optimized for server execution.

## Risks

- **CST Complexity:** Working with a CST is more verbose than a standard AST. We will use the typed `cst` wrappers provided by the library to mitigate this.
- **Dependency Footprint:** `apollo-parser` brings in `rowan` and other specialized crates, but this is justified by the feature set.

## Done looks like

- This decision is recorded in the design document.
- Phase 2 spike is closed.
- Phase 3 (Parser Implementation) is ready to pull `apollo-parser`.
