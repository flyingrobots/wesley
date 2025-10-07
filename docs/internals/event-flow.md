# Event Flow (Internals)

This note sketches the high‑level flow from GraphQL SDL to emitted artifacts:

1) Parse SDL → Domain Schema (events: SchemaParsed)
2) Analyze → Differences/Operations (events: SchemaAnalyzed, OperationsHarvested)
3) Plan → Phased DDL (events: PlanComputed)
4) Generate → SQL, Types, Zod, RLS, pgTAP (events: ArtifactsEmitted)
5) Certify → Evidence bundle + SHIPME (events: EvidenceProduced)

All core phases emit events that can be observed by hosts/adapters. The core remains pure and testable; IO lives in host‑node.

