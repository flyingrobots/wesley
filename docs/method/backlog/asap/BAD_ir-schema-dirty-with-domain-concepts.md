# BAD: ir.schema.json contains Domain-Specific Concepts

- Lane: `asap`
- Legend: `BAD`

## Why (Engineering Standard Violation)

The current `schemas/ir.schema.json` defines explicit structures for `Table`, `Index`, `ForeignKey`, `RLSConfig`, and `TenantConfig`.

According to Wesley doctrine (domain-empty core), these are specific to the PostgreSQL/Relational domain. Their presence in the core IR schema violates the hard boundary between the compiler kernel and target semantics.

## Done looks like

- `ir.schema.json` is refactored to be domain-neutral.
- `Table` becomes a generic `Resource` or `Collection`.
- `Index`, `ForeignKey`, `RLS`, etc., are removed as top-level schema concepts and instead exist as entries in generic `directives` maps.
- The Core IR focuses on "Semantic Truth" (normalized types, fields, values, and metadata) rather than "Target Truth" (SQL types, indexes, policies).

## Repo Evidence

- `schemas/ir.schema.json`
- `crates/wesley-core/src/domain/ir.rs`
