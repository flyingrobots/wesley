# Canonical Schemas

This directory hosts machine-readable schemas that underpin Wesley’s generators and evidence tooling.

- `directives.graphql` – The GraphQL SDL that defines Wesley's generic custom directives. Keep this in sync with the core directive registry. Product-specific directive families, including TTD protocol directives, belong in their owning modules.
- `ir.schema.json` – JSON Schema describing the Wesley IR representation.
- `weslaw-v1.schema.json` – Versioned, canonical JSON Schema describing the
  `weslaw/v1` authoring document shape.
- `wesley-law-ir-v1.schema.json` – Versioned, canonical JSON Schema describing
  the normalized `wesley.law-ir/v1` representation.
- `wesley-contract-bundle-manifest-v1.schema.json` – Versioned, canonical JSON
  Schema describing the emitted `wesley.contract-bundle-manifest/v1` shape.
- `wesley-law-diff-v1.schema.json` – Versioned, canonical JSON Schema
  describing machine-readable `wesley.law-diff/v1` semantic law diff reports.
- `evidence-map.schema.json` – JSON Schema for the evidence bundle map emitted by HOLMES/-SHIPME flows.
- `scores.schema.json` – JSON Schema for holmes `scores.json` output.

> [!note]
> When a schema evolves, update the corresponding validation logic/tests and regenerate fixtures so downstream consumers stay aligned.

The `weslaw` and contract bundle schema artifacts are checked in as canonical
JSON: object keys are lexicographically sorted and the files contain no
formatting whitespace. That byte form is for deterministic publication and
review only; semantic law hashes must still be computed from normalized Law IR,
not schema-file bytes.

The `weslaw/v1` authoring schema accepts explicitly marked draft scaffolding
for review queues, including future draft law shapes. The normalized Law IR
schema is self-contained, rejects draft entries, and discriminates each active
entry `kind` against the matching normalized `body` shape.
