# Wesley Directive Truth Table
<!-- docs-truth: status=current owner=@flyingrobots -->

This page describes the directive support Wesley actually ships today.

The repo-wide directive registry in [schemas/directives.graphql](../schemas/directives.graphql) is broader than the main `generate -> plan -> rehearse -> certify` path. The current Node hot path is grounded in the GraphQL adapter at [packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs](../packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs), so this document classifies directives by what that path truly parses and lowers today.

## Support Levels

- `current`: parsed from SDL and used by a shipped command path today.
- `experimental`: present in fixtures, legacy IR consumers, or downstream generators, but not guaranteed end-to-end on the main SDL hot path.
- `ttd-only`: parsed by legacy TTD internals, not by the main database compiler
  path or a generic Wesley CLI command.
- `deferred`: declared in the registry or docs, but not yet part of a stable public contract.

## Current On The Main Database Compiler Path

These directives are the stable SDL surface for the current `generate`, `plan`, `rehearse`, `transform`, and `certify`-adjacent database/compiler flow.

| Directive | Status | Current lowering | Aliases accepted by current parser | Notes |
| --- | --- | --- | --- | --- |
| `@wes_table` | `current` | Marks an object type as a table | `@wesley_table`, `@table` | Required to turn an object into a table in the main IR. |
| `@wes_pk` | `current` | Marks the primary key field | `@wesley_pk`, `@pk`, `@primaryKey` | Enforced as at most one per table; field must be non-null. |
| `@wes_fk(ref: "Table.column")` | `current` | Lowers to structured foreign-key metadata | `@wesley_fk`, `@fk`, `@foreignKey` | Main path validates the `Table.column` format and target existence. |
| `@wes_unique` | `current` | Lowers to a field uniqueness flag | `@wesley_unique`, `@unique` | Used by SQL/test generation paths. |
| `@wes_index` | `current` | Lowers to a field index flag | `@wesley_index`, `@index` | Field-level indexing is current; richer table/composite semantics are still limited. |
| `@wes_tenant(by: "...")` | `current` | Lowers to tenant metadata on the table | `@wesley_tenant`, `@tenant` | The `by` field must exist on the same type. |
| `@wes_default(value: "...")` | `current` | Lowers to a field default expression/value | `@wesley_default`, `@default` | Canonical argument is `value`; the parser still accepts legacy `expr` on the hot path. |
| `@wes_rls` | `current` | Presence is lowered into table RLS metadata | `@wesley_rls`, `@rls` | Treat this as an enable/presence marker today; full option semantics are not yet a stable hot-path contract. |

### Composition Directives

These are current, but they belong to schema composition rather than table/column compilation:

| Directive | Status | Current lowering | Notes |
| --- | --- | --- | --- |
| `@wes_package(name: "...")` | `current` | Used by composition and name-mangling flows | Supported through [packages/wesley-core/src/domain/SchemaResolver.mjs](../packages/wesley-core/src/domain/SchemaResolver.mjs). |
| `@wes_import(from: "...")` | `current` | Used to resolve composed schema units | Current for composed-schema flows such as `generate --schema-root`. |

## Experimental Or Partial Directive Families

These directives exist in the registry and some downstream code paths, but they are not yet a stable, end-to-end SDL contract on the main database compiler path.

| Directive family | Status | Reality today |
| --- | --- | --- |
| `@wes_uid`, `@wes_weight`, `@wes_critical`, `@wes_sensitive`, `@wes_pii` | `experimental` | Legacy/domain consumers such as HOLMES/test-depth, EvidenceMap, SQL/Zod generators, and internal fixtures still understand the older `@uid`, `@weight`, `@critical`, `@sensitive`, and `@pii` shapes once they are already present in IR/domain objects. The current GraphQL adapter does not canonically lower the `@wes_*` forms of these directives into the main IR. |
| `@wes_hasMany`, `@wes_belongsTo` | `experimental` | Relationship hints exist in the registry and legacy/domain consumers such as `OperationRegistry`, but the main GraphQL SDL hot path does not lower canonical `@wes_hasMany` / `@wes_belongsTo` into stable relationship semantics. Some older bare names still act as relation-only hints in limited parser code paths. |
| `@wes_owner`, `@wes_grant`, `@wes_noRPC` | `experimental` | RPC/policy generators and tenant helpers consume these directives when they already exist on domain tables, but the current GraphQL SDL hot path does not guarantee canonical end-to-end support for them. |

## TTD-Only Directives

These directives are real in the legacy Typed Transition Dynamics internals,
but they are not part of the main database compiler contract and generic Wesley
no longer ships a public `compile-ttd` command or `@wesley/core/ttd` package
export. Reintroduce them through a Continuum-owned module command if that path
is still needed.

| Directive family | Status | Current surface |
| --- | --- | --- |
| `@wes_channel`, `@wes_op`, `@wes_rule`, `@wes_invariant` | `ttd-only` | Parsed by the relocated Continuum TTD internals in `continuum/wesley/ttd/directives.mjs`, not by generic Wesley core. |
| `@wes_emission`, `@wes_footprint`, `@wes_requires`, `@wes_produces`, `@wes_emitsTo`, `@wes_mustEmit` | `ttd-only` | Current in the relocated Continuum TTD extraction/manifest path, not in the database compiler hot path. |
| `@wes_codec`, `@wes_version` | `ttd-only` | Current for relocated Continuum TTD/type-registry compilation paths and related manifests, not for the main SDL-to-DDL flow. |

## Deferred Or Unstable Surface

The directive registry and draft docs still contain broader semantics than the main compiler path currently guarantees.

| Surface | Status | Notes |
| --- | --- | --- |
| Full `@wes_rls(...)` option matrix | `deferred` | The registry exposes a broad option shape, but the stable hot-path contract today is the presence of `@wes_rls`, not the full option matrix. |
| Broad alias support beyond the core compiler directives | `deferred` | The registry declares many alias forms, but the current parser alias map only covers the core compiler directives plus `@wes_rls`. |
| “Everything in `schemas/directives.graphql` is supported by `generate`” | `deferred` | That is not true today and should not be assumed. |

## Practical Guidance

- If you want the boring, reproducible happy path today, use only the core compiler directives plus optional `@wes_package` / `@wes_import`.
- Prefer canonical `@wes_*` names in new schemas, even where older aliases still parse.
- Use `@wes_default(value: "...")` in docs and new examples. The parser still accepts `expr`, but that is a compatibility affordance, not the canonical form.
- Treat the identity, scoring, relation, RPC, and policy hint directives as experimental unless the specific command path you are using proves support end to end.
- If you are working on protocol/TTD flows, use a Continuum-owned module or
  package once it exists; do not assume TTD directives are part of
  `wesley generate`.

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
