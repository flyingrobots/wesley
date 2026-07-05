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
- `wesley-target-descriptor-v1.schema.json` – JSON Schema for
  `wesley.target-descriptor/v1` external target descriptors.
- `wesley-target-request-v1.schema.json` – JSON Schema for
  `wesley.target-request/v1` external target request envelopes.
- `wesley-target-response-v1.schema.json` – JSON Schema for
  `wesley.target-response/v1` external target response envelopes.
- `wesley-target-diagnostic-v1.schema.json` – JSON Schema for machine-readable
  target diagnostics used by the external target protocol.
- `wesley-target-artifact-manifest-v1.schema.json` – JSON Schema for
  `wesley.target-artifact-manifest/v1` target artifact manifests.
- `evidence-map.schema.json` – JSON Schema for the evidence bundle map emitted by HOLMES/-SHIPME flows.
- `scores.schema.json` – JSON Schema for holmes `scores.json` output.

> [!note]
> When a schema evolves, update the corresponding validation logic/tests and regenerate fixtures so downstream consumers stay aligned.

Run `cargo test -p wesley-core --test generated_json_artifacts` to validate the
representative generated JSON artifact families against the schemas in this
directory. The full `cargo xtask preflight` gate runs those tests through
`cargo test --workspace`, and the Rust product CI workflow watches `schemas/`,
`test/fixtures/ir-parity/`, and `test/fixtures/weslaw/` for schema/fixture
drift.

The `weslaw` and contract bundle schema artifacts are checked in as canonical
JSON: object keys are lexicographically sorted and the files contain no
formatting whitespace. That byte form is for deterministic publication and
review only; semantic law hashes must still be computed from normalized Law IR,
not schema-file bytes.

The `weslaw/v1` authoring schema accepts explicitly marked draft scaffolding
for review queues, including future draft law shapes. The normalized Law IR
schema is self-contained, rejects draft entries, and discriminates each active
entry `kind` against the matching normalized `body` shape.
