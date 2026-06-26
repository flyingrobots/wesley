# Directives

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when deciding which GraphQL directives are current Wesley
surface area.

Directive support is not "everything ever mentioned in old docs." Current
support is what the Rust-native SDL path actually parses, validates, lowers, or
preserves for current command paths.

## Stable Current Path

Use canonical `@wes_*` directive names for new generic Wesley examples.
Common current compiler directives include:

- `@wes_table`
- `@wes_pk`
- `@wes_fk`
- `@wes_unique`
- `@wes_index`
- `@wes_tenant`
- `@wes_default`
- `@wes_rls`

Some historical aliases still parse for compatibility. New docs should prefer
canonical names.

## Boundary Rules

- Product directive families belong with their owning module or repo.
- TTD, Continuum, Echo, renderer, database, and runtime directives are not
  generic Wesley surface unless the current directive reference says so.
- Registry presence alone does not prove end-to-end command support.
- Dead or historical directive examples should stay in archives or migration
  context, not in current quick starts.

## Related Authority

- [Directive Truth Table](../reference/directives.md)
- [Schema And IR](./schema-ir.md)
- [Compiler Boundary](./compiler-boundary.md)
- [Extending Wesley](../guides/extending.md)
