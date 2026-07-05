# Directives

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when deciding which GraphQL directives are current Wesley
surface area.

Directive support is not "everything ever mentioned in old docs." Current
support is what the Rust-native SDL path actually parses, validates, lowers, or
preserves for current command paths.

## Current Compatibility Path

Existing core directive names are compatibility structure, not domain ownership.
When current command paths parse names such as the list below, Wesley lowers or
preserves structural metadata and leaves target meaning to downstream modules.

- `@wes_table`
- `@wes_pk`
- `@wes_fk`
- `@wes_unique`
- `@wes_index`
- `@wes_tenant`
- `@wes_default`
- `@wes_rls`

Do not present these names as proof that Wesley owns database, tenant, policy,
runtime, or renderer semantics. For new generic Wesley examples, prefer
directive examples that demonstrate preservation or law metadata without
assigning target meaning. When documenting the existing current-path directives,
use canonical `@wes_*` names and point to the directive truth table.

## Boundary Rules

- Product directive families belong with their owning module or repo.
- TTD, Continuum, Echo, renderer, database, and runtime directives are not
  generic Wesley surface unless the current directive reference says so.
- Registry presence alone does not prove end-to-end command support.
- Dead or historical directive examples belong in git history, not in current
  quick starts.

## Related Authority

- [Directive Truth Table](../reference/directives.md)
- [Schema And IR](./schema-ir.md)
- [Compiler Boundary](./compiler-boundary.md)
- [Extending Wesley](../guides/extending.md)
