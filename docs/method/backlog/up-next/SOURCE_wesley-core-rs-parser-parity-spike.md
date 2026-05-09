# Wesley core-rs parser parity spike

- Lane: `up-next`
- Legend: `SOURCE`

## Why now

The design names `apollo-parser` and `async-graphql-parser` as likely parser
candidates, but parser choice can change directive handling, extension
semantics, comments, locations, and error spans. That choice needs evidence
before Rust lowering claims parity.

## Hill

A maintainer can choose the Rust GraphQL parser using fixture evidence instead
of library vibes.

## Done looks like

- compare at least two parser candidates against the Phase 0 fixture corpus
- record directive AST shape, schema extension support, invalid SDL behavior,
  location/span quality, comment handling, maintenance posture, and dependency
  footprint
- decide which differences are acceptable and which require adapter code
- document parser-sensitive behavior that affects canonical IR hashes
- add the decision to the Rust core design packet or its follow-on packet

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `docs/method/backlog/asap/SOURCE_wesley-core-rs-ir-contract-and-fixtures.md`
- `packages/wesley-core/src/`
- `packages/wesley-core/test/`
