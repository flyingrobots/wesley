---
title: Parser parity spike
legend: SOURCE
packet: 0013-rust-ir-parity-sentinel
status: active
release: v0.0.6
---

# Parser parity spike

## Why Now

The v0.0.6 parity sentinel compares projected semantic facts after both
lowerers have accepted a fixture. That is necessary, but it does not separately
answer whether the legacy JS parser/lowerer and Rust `apollo-parser` lowering
surface accept or reject the same parser-sensitive inputs.

Parser choice affects directive handling, extension semantics, list wrapper
shape, invalid-SDL diagnostics, and location/span quality. Those facts need
fixture evidence before Rust lowering claims broader compatibility.

## Hill

Wesley has one parser parity evidence command that compares legacy
`GraphQLAdapter.parseSDL` acceptance with Rust `wesley schema lower`
acceptance over explicit fixtures.

The command is:

```bash
pnpm parity:parser
```

## Implemented Slice

`pnpm parity:parser` emits `parser-parity-spike.v0` evidence for the explicit
parser-sensitive corpus:

- `test/fixtures/ir-parity/small-schema.graphql`: both lowerers accept
- `test/fixtures/ir-parity/schema-extensions-schema.graphql`: both lowerers
  accept extension-folded type-family SDL
- `test/fixtures/ir-parity/nested-list-schema.graphql`: both lowerers accept
  nested list type references
- `test/fixtures/ir-parity-invalid/parser-syntax-error.graphql`: both lowerers
  reject invalid SDL syntax
- `test/fixtures/ir-parity-invalid/duplicate-directive-alias.graphql`: both
  lowerers reject duplicate canonical core directives after alias normalization

The invalid cases remain outside the default `pnpm parity:ir` corpus because
projection parity fixtures compare accepted semantic outputs under a named
projection.

## Projection Gap Decision

The spike exposed one useful projection gap: nested GraphQL list wrappers were
accepted by Rust L1 but were not representable in the existing type-family
projection. The release closes that gap by admitting
`nested-list-schema.graphql` under
`js-sdl-type-family-vs-rust-l1-type-family.v0`.

No third projection is added in this slice. The table projection still owns
table-compatible facts, and the type-family projection now owns structural type
facts including nested list wrappers.

## Parser Choice Decision

Keep `apollo-parser` for v0.0.6.

The current Rust adapter already provides:

- SDL parsing for the active valid fixture corpus
- schema extension aggregation for scalar, object, interface, union, enum, and
  input object definitions
- stable parse diagnostics through `WESLEY_PARSE_ERROR` with parser spans where
  Apollo exposes a byte index
- stable lowering diagnostics through `WESLEY_LOWERING_ERROR` for semantic
  guards that do not yet carry source spans

The release does not compare a second Rust parser implementation. That remains
future parser-port research, not a v0.0.6 release blocker.

## Non-Goals

- Do not retire legacy Node lowering in this spike.
- Do not admit invalid SDL fixtures to the semantic parity corpus.
- Do not add product, database, runtime, scheduler, or transport semantics.
- Do not claim semantic lowering spans until the Rust lowerer actually exposes
  them.
