# Wesley Core Footprint Check CLI

- Lane: `cool-ideas`
- Legend: `SOURCE`

## Why now

`wesley-core` now exposes operation footprint extraction as pure Rust data:
declared reads, declared writes, and the actual GraphQL selection paths. The
next useful standalone surface is a small command that turns that extraction
into an honesty check without requiring Echo, Graft, MCP, or external module
infrastructure.

## Hill

A maintainer can run one command against an operation document and get a clear
pass/fail answer for whether the declared `@wes_footprint` covers the actual
selection set.

## Done looks like

- `wesley check-footprint` accepts an operation document path
- the command can optionally accept a schema path for later schema-aware
  validation
- declared reads and writes are compared against `actual_selections`
- honest footprints exit zero
- dishonest footprints exit non-zero with a concise diagnostic and JSON mode
- the command is backed by `wesley-core::extract_footprint`

## Repo Evidence

- `crates/wesley-core/src/adapters/apollo.rs`
- `crates/wesley-core/src/domain/footprint.rs`
- `crates/wesley-core/tests/footprint_extraction.rs`
