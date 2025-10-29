# Event Flow (Internals)

This note sketches the high‑level flow from GraphQL SDL to emitted artifacts:

1) Parse SDL → Domain Schema (events: SchemaParsed)
2) Generate → SQL, Types (events: SQLGenerated, TypeScriptGenerated)
3) Diff/Plan → Migrations (events: MigrationDiffCalculated, MigrationSQLGenerated)
4) Write → Files (events: FileWriteRequested, FileWritten)

Notes
- The earlier docs referenced additional events (SchemaAnalyzed, OperationsHarvested, PlanComputed, ArtifactsEmitted, EvidenceProduced). These are not implemented yet and are reserved for future phases. Current implementations emit the event classes found in `packages/wesley-core/src/domain/Events.mjs`.
- The core remains pure and testable; IO concerns live in host‑node adapters.
