# @wes_join Directive

Schema-driven merge semantics for deterministic simulation.

## Overview

When multiple peers modify shared state concurrently, the simulation engine must merge those changes deterministically. The `@wes_join` directive declares a **lattice join strategy** on each field so that Echo's merge engine can resolve concurrent writes without coordination.

A valid join strategy must satisfy the **ACI properties** (see below) to guarantee that merge order never affects the outcome.

## Strategies

### `union` -- Set Union

Merges list-typed fields by taking the union of both sets. Duplicate elements are discarded.

**Allowed on:** list fields only (`[T]`, `[T!]!`, etc.)

```graphql
players: [String!]! @wes_join(strategy: "union")
```

### `max` -- Max / Cap Lattice

Retains the greater of two numeric values. Useful for high-water marks, counters that only grow, and score caps.

**Allowed on:** `Int` and `Float` fields only.

```graphql
maxScore: Int! @wes_join(strategy: "max")
```

### `lww` -- Last-Writer-Wins

Keeps the value with the latest timestamp. This is the most permissive strategy and works on any field type, but it requires an external ordering mechanism (e.g., a Lamport clock or wall-clock timestamp) to decide which write is "last."

**Allowed on:** any field type.

```graphql
lastUpdate: String @wes_join(strategy: "lww")
```

## Complete Example

```graphql
type GameState @wes_table {
  id: ID! @pk
  players: [Player!]!   @wes_join(strategy: "union")
  maxScore: Int!        @wes_join(strategy: "max")
  lastUpdate: String    @wes_join(strategy: "lww")
}
```

## Validation Rules

| Rule | Error message |
|------|---------------|
| `union` on a non-list field | `@wes_join(strategy: "union") requires a list field, but "fieldName" is TypeName` |
| `max` on a non-numeric field | `@wes_join(strategy: "max") requires Int or Float, but "fieldName" is TypeName` |
| Unknown strategy | `Unknown @wes_join strategy "bad". Valid: union, max, lww` |
| `@wes_join` on a type (not a field) | `@wes_join is only valid on field definitions, not on type "TypeName"` |

`lww` has no type restriction -- it is accepted on any field.

## ACI Property Requirements

Every CRDT join function must be:

- **Associative** -- `merge(a, merge(b, c)) == merge(merge(a, b), c)`. Grouping does not matter.
- **Commutative** -- `merge(a, b) == merge(b, a)`. Order does not matter.
- **Idempotent** -- `merge(a, a) == a`. Re-applying the same state is a no-op.

All three built-in strategies (`union`, `max`, `lww`) satisfy ACI. If you implement a custom strategy in the future it must also satisfy these properties or deterministic replay will diverge.

## Generated Output (IR)

When `@wes_join` is present on a field, the internal representation stores the metadata in the field's directives under `@join`:

```js
const field = schema.getTable('GameState').getField('maxScore');
field.getJoin();  // { strategy: 'max' }

// Fields without @wes_join:
field.getJoin();  // null
```

The canonical AST (via `schema.toAST()`) also includes the `@join` directive on each annotated field, making it available to downstream generators.

## Interaction with Echo

Echo's merge engine reads `@join` metadata from the compiled IR to decide how to reconcile concurrent state updates during deterministic replay. Each field's declared strategy is dispatched at merge time, allowing a single type to mix strategies (e.g., `union` for collections alongside `max` for counters). Fields without `@wes_join` are not merged automatically and must be handled by application logic or default to replacement semantics.
