# IR Family Overview

Wesley uses a small, versioned IR family rather than a single monolithic IR:

- Schema IR (canonical): `schemas/ir.schema.json`
  - Produced by the GraphQL parser; consumed by generators, diff/planner, and rehearsal.
  - Captures tables, columns, directives, PK/FK/indexes, tenant/owner hints.
- Query IR (QIR): `schemas/qir.schema.json`
  - Produced by op→plan builders/compilers; consumed by `lowerToSQL` and emission wrappers.
  - Captures relations, projections, predicates, params, ordering, and pagination.

Cross‑references
- QIR references schema entities by name (e.g., `TableNode.table`).
- During lowering, callers may provide `pkResolver(plan)` that maps the QIR root table to a Schema IR key for deterministic ORDER BY tie‑breakers.

Versioning
- Both schemas live under `schemas/` and can evolve independently with semantic version notes in CHANGELOG.
- Tests validate representative instances of each to prevent drift.

Validation
- Evidence schemas are validated in CLI (`validate-bundle`).
- QIR schema is validated in CLI Bats tests (`test/qir-schema.bats`).

Planned envelope (future)
- A top‑level envelope can bundle both together for audits:
  - `{ schema: <SchemaIR>, ops: { plans: <QIR[]> }, evidence: {...}, version: "vX" }`.

