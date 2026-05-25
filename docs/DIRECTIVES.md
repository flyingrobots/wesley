# Wesley Directive Truth Table

<!-- docs-truth: status=current owner=@flyingrobots -->

This page describes the directive support Wesley actually ships today.

The repo-wide directive registry in
[schemas/directives.graphql](../schemas/directives.graphql) is Wesley's generic
registry. Product directive families, including the TTD protocol family, live
with their owning modules instead of being declared as generic Wesley
directives. The current compiler hot path is the Rust Apollo lowering adapter in
`crates/wesley-core/src/adapters/apollo.rs`, so this document classifies
directives by what that path truly parses and lowers today.

## Support Levels

- `current`: parsed from SDL and used by a shipped command path today.
- `experimental`: present in fixtures, legacy IR consumers, or downstream generators, but not guaranteed end-to-end on the main SDL hot path.
- `external`: owned by an external module or product repo, not by generic
  Wesley.
- `deferred`: declared in the registry or docs, but not yet part of a stable public contract.

## Current On The Main Database Compiler Path

These directives are the stable SDL surface for the current Rust-native schema
lowering, hashing, diffing, and emitter flows.

| Directive                      | Status    | Current lowering                            | Aliases accepted by current parser | Notes                                                                                                        |
| ------------------------------ | --------- | ------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@wes_table`                   | `current` | Marks an object type as a table             | `@wesley_table`, `@table`          | Required to turn an object into a table in the main IR.                                                      |
| `@wes_pk`                      | `current` | Marks the primary key field                 | `@wesley_pk`, `@pk`, `@primaryKey` | Enforced as at most one per table; field must be non-null.                                                   |
| `@wes_fk(ref: "Table.column")` | `current` | Lowers to structured foreign-key metadata   | `@wesley_fk`, `@fk`, `@foreignKey` | Main path validates the `Table.column` format and target existence.                                          |
| `@wes_unique`                  | `current` | Lowers to a field uniqueness flag           | `@wesley_unique`, `@unique`        | Preserved in IR for downstream emitters and external targets.                                                |
| `@wes_index`                   | `current` | Lowers to a field index flag                | `@wesley_index`, `@index`          | Field-level indexing is current; richer table/composite semantics are still limited.                         |
| `@wes_tenant(by: "...")`       | `current` | Lowers to tenant metadata on the table      | `@wesley_tenant`, `@tenant`        | The `by` field must exist on the same type.                                                                  |
| `@wes_default(value: "...")`   | `current` | Lowers to a field default expression/value  | `@wesley_default`, `@default`      | Canonical argument is `value`; the parser still accepts legacy `expr` on the hot path.                       |
| `@wes_rls`                     | `current` | Presence is lowered into table RLS metadata | `@wesley_rls`, `@rls`              | Treat this as an enable/presence marker today; full option semantics are not yet a stable hot-path contract. |

### Composition Directives

These are registered, but the deleted legacy Node composition resolver is no
longer the product front door. Treat composition as a deferred external-module
or future Rust design surface, not as a current generic compiler guarantee.

| Directive                   | Status     | Current lowering      | Notes                                                                                                                             |
| --------------------------- | ---------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@wes_package(name: "...")` | `deferred` | Registered shape only | Historical Node composition used this directive; current Rust lowering preserves custom directives but does not resolve packages. |
| `@wes_import(from: "...")`  | `deferred` | Registered shape only | Reintroduce schema composition through an explicit Rust or external-module design before documenting it as current.               |

## Experimental Or Partial Directive Families

These directives exist in the registry and some downstream code paths, but they are not yet a stable, end-to-end SDL contract on the main database compiler path.

| Directive family                                                         | Status         | Reality today                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@wes_uid`, `@wes_weight`, `@wes_critical`, `@wes_sensitive`, `@wes_pii` | `experimental` | Historical consumers understood older `@uid`, `@weight`, `@critical`, `@sensitive`, and `@pii` shapes once they were already present in IR/domain objects. The current Rust adapter does not canonically lower the `@wes_*` forms of these directives into the main IR. |
| `@wes_hasMany`, `@wes_belongsTo`                                         | `experimental` | Relationship hints exist in the registry, but the main Rust SDL hot path does not lower canonical `@wes_hasMany` / `@wes_belongsTo` into stable relationship semantics.                                                                                                 |
| `@wes_owner`, `@wes_grant`, `@wes_noRPC`                                 | `experimental` | RPC/policy directives remain registry-level or external-target hints; the current Rust SDL hot path does not guarantee canonical end-to-end support for them.                                                                                                           |

## External TTD Directives

These directives are real in the Continuum-owned Typed Transition Dynamics
module, but they are not declared by Wesley's generic directive registry and
are not part of the main database compiler contract. Generic Wesley no longer
ships a public `compile-ttd` command or old core TTD package export.

| Directive family                                                                                     | Status     | Current surface                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@wes_channel`, `@wes_op`, `@wes_rule`, `@wes_invariant`                                             | `external` | Declared in `continuum/wesley/ttd/schemas/ttd-directives.graphql` and parsed by `continuum/wesley/ttd/directives.mjs`, not by generic Wesley core. |
| `@wes_emission`, `@wes_footprint`, `@wes_requires`, `@wes_produces`, `@wes_emitsTo`, `@wes_mustEmit` | `external` | Current in the relocated Continuum TTD extraction/manifest path, not in the database compiler hot path.                                            |
| `@wes_codec`, `@wes_version`                                                                         | `external` | Current for relocated Continuum TTD/type-registry compilation paths and related manifests, not for the main SDL-to-DDL flow.                       |

## Deferred Or Unstable Surface

The directive registry and draft docs still contain broader semantics than the main compiler path currently guarantees.

| Surface                                                                      | Status     | Notes                                                                                                                                        |
| ---------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Full `@wes_rls(...)` option matrix                                           | `deferred` | The registry exposes a broad option shape, but the stable hot-path contract today is the presence of `@wes_rls`, not the full option matrix. |
| Broad alias support beyond the core compiler directives                      | `deferred` | The registry declares many alias forms, but the current parser alias map only covers the core compiler directives plus `@wes_rls`.           |
| “Everything in `schemas/directives.graphql` is supported by native emitters” | `deferred` | That is not true today and should not be assumed.                                                                                            |

## Practical Guidance

- If you want the boring, reproducible happy path today, use only the core compiler directives.
- Prefer canonical `@wes_*` names in new schemas, even where older aliases still parse.
- Use `@wes_default(value: "...")` in docs and new examples. The parser still accepts `expr`, but that is a compatibility affordance, not the canonical form.
- Treat the identity, scoring, relation, RPC, and policy hint directives as experimental unless the specific command path you are using proves support end to end.
- If you are working on protocol/TTD flows, use the Continuum-owned module or
  package; do not assume TTD directives are part of generic Wesley emitters or
  the generic `schemas/directives.graphql` registry.

## Minimal Happy-Path Example

```graphql
type Organization @wes_table {
  id: ID! @wes_pk
  slug: String! @wes_unique @wes_index
  created_at: DateTime! @wes_default(value: "now()")
}

type Account @wes_table @wes_tenant(by: "org_id") @wes_rls {
  id: ID! @wes_pk
  org_id: ID! @wes_fk(ref: "Organization.id") @wes_index
  email: String! @wes_unique
  active: Boolean! @wes_default(value: "true")
}
```
