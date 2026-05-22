---
title: Type-family parity projection
legend: SOURCE
packet: 0013-rust-ir-parity-sentinel
status: active
release: v0.0.6
---

# Type-family parity projection

## Why Now

`schema-extensions-schema.graphql` already passes the current
`js-table-vs-rust-table.v0` projection when run as an explicit fixture. That is
useful, but narrow: it proves the folded table facts agree and says nothing
about the scalar, interface, union, enum, or input-object facts that made the
fixture worth adding to the Rust L1 corpus.

The legacy JS `GraphQLAdapter.parseSDL` table IR intentionally drops those
non-table facts. Widening the current table projection and declaring victory
would therefore be false evidence.

## Hill

Wesley names a second parity projection before admitting schema-extension and
non-table fixtures to the default parity sentinel corpus.

That projection compares GraphQL type-family structure fairly:

- JS side: canonical SDL structure from the GraphQL AST after extension
  folding
- Rust side: projected Rust L1 type-family facts

The projection must not depend on product, database, runtime, or generated-code
semantics.

## Projection Name

Use:

```text
js-sdl-type-family-vs-rust-l1-type-family.v0
```

This name is intentionally explicit. The JS side is not the legacy table IR; it
is a canonical SDL structural projection produced in JS from the parsed SDL.
The Rust side is L1 IR projected into the same structural shape.

## First Fixture

The first default-corpus candidate is:

```text
test/fixtures/ir-parity/schema-extensions-schema.graphql
```

Current observed behavior:

- `pnpm parity:ir --fixture test/fixtures/ir-parity/schema-extensions-schema.graphql`
  passes under `js-table-vs-rust-table.v0`
- that pass covers only the `users` and `teams` table facts
- legacy table IR reports empty `enums`, `scalars`, and `relationships`
- Rust L1 retains `DateTime`, `Named`, `Node`, `Timestamped`, `SearchResult`,
  `Status`, and `UserFilter`

Therefore, admitting this fixture to the default parity corpus requires the new
type-family projection, not just adding it to the current table fixture list.

## Included Facts

The v0 projection includes these generic GraphQL facts:

- scalar type names and directives
- object type names
- object implemented interfaces
- object field names, type references, default values, and directives
- interface names
- interface implemented interfaces
- interface field names, type references, default values, and directives
- union names and member type names
- enum names and enum value names
- input object names
- input field names, type references, default values, and directives

The projection includes only facts that both sides can derive from SDL and Rust
L1 without target-specific interpretation.

## Excluded Facts

The v0 projection excludes:

- table-specific compatibility facts already covered by
  `js-table-vs-rust-table.v0`
- generated relationship records
- operation catalogs and runtime optic facts
- directive location validation
- product, database, scheduler, transport, replication, and deployment
  semantics
- invalid SDL diagnostics
- performance measurements

These exclusions keep the projection structural. Other release slices own those
contracts.

## Normalization Rules

- Fold `extend scalar`, `extend type`, `extend interface`, `extend union`,
  `extend enum`, and `extend input` blocks into their base definitions before
  projection.
- Sort projected type records by deterministic code-point order of
  `kind:name`.
- Sort projected field, argument, enum value, union member, interface, and
  directive arrays by deterministic code-point order because the projection
  treats them as semantic fact sets.
- Preserve GraphQL nullability and list wrapper structure.
- Preserve directive argument values after each side has produced semantic
  values.
- Preserve Rust L1 canonical core directive names.
- Do not use this projection to prove legacy directive alias behavior unless
  the admitted fixture uses canonical directive spelling or the JS structural
  projection explicitly normalizes aliases as a named lowerer rule.
- Remove top-level envelope metadata before hashing.

## Implementation Shape

The implementation should add projection selection instead of overloading the
current table projection.

Expected shape:

- keep `js-table-vs-rust-table.v0` as the default table projection
- add `js-sdl-type-family-vs-rust-l1-type-family.v0`
- allow fixtures to name their projection
- keep failure reports keyed by projection, fixture, mismatch path, legacy
  hash, and Rust hash
- admit `schema-extensions-schema.graphql` to the default sentinel corpus only
  after the new projection passes

The JS-side structural projection may reuse the existing canonical SDL
machinery in `packages/wesley-core/src/domain/canonicalize.mjs`, but the
projected comparison shape must be documented in code rather than relying on
raw canonical bytes alone.

## Playback Questions

1. Does the projection name make clear which lowerer/projection source is used
   on each side?
2. Does the projection compare non-table type-family facts that the current
   table adapter drops?
3. Does the fixture admission rule prevent `schema-extensions-schema.graphql`
   from becoming default parity evidence before the new projection exists?
4. Does the implementation avoid product, database, and runtime semantics?
5. Does failure output still identify the first semantic mismatch path?

## Non-Goals

- Do not retire legacy Node lowering in this projection.
- Do not broaden Rust L1 golden regeneration.
- Do not add Nine Lives, WASM runtime policy, or module runtime behavior.
- Do not change Echo, jedit, Continuum, `git-warp`, `warp-ttd`, or
  `wesley-postgres`.
