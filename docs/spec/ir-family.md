# IR Family Overview

Wesley uses a small, versioned IR family rather than a single monolithic IR:

> See also: [IR Family Specification and Design](ir-family-spec.md) for the full prose specification.

- Schema IR (canonical): `schemas/ir.schema.json`
  - Produced by the GraphQL parser; consumed by generators, diff/planner, and rehearsal.
  - Captures tables, columns, directives, PK/FK/indexes, tenant/owner hints.
- Query IR (QIR): `schemas/qir.schema.json`
  - Produced by op→plan builders/compilers; consumed by `lowerToSQL` and emission wrappers.
  - Captures relations, projections, predicates, params, ordering, and pagination.
- Plan IR: `schemas/plan-report.schema.json`
  - Produced by `wesley plan --explain --json`; consumed by CI and human review.
  - Captures phases, steps, lock classifications, and SQL previews.
- REALM IR: `schemas/realm.schema.json`
  - Produced by `wesley rehearse --dry-run --json`; consumed by CI gating.
  - Captures rehearsal verdict, timings, counters, and structured notes.
- Ops Manifest: `schemas/ops-manifest.schema.json`
  - Curated discovery descriptor listing included/excluded op files and directories.
- Ops Registry: `schemas/ops-registry.schema.json`
  - Machine-readable index of compiled ops emitted to `out/ops/registry.json`.

## Cross‑references
- QIR references schema entities by name (e.g., `TableNode.table`).
- During lowering, callers may provide `pkResolver(plan)` that maps the QIR root table to a Schema IR key for deterministic ORDER BY tie‑breakers.

## Versioning
- Both schemas live under `schemas/` and can evolve independently with semantic version notes in CHANGELOG.
- Tests validate representative instances of each to prevent drift.

## Validation
- Evidence schemas are validated in CLI (`validate-bundle`).
- QIR schema is validated in CLI Bats tests (`packages/wesley-cli/test/qir-schema.bats`).

## Envelope
- A top‑level envelope bundles both together for audits:
  - `{ schema: <SchemaIR>, ops: { plans: <QIR[]> }, evidence: {...}, version: "vX" }`.
