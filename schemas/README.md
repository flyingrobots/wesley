# Canonical Schemas

This directory hosts machine-readable schemas that underpin Wesley’s generators and evidence tooling.

- `directives.graphql` – The GraphQL SDL that defines Wesley's generic custom directives. Keep this in sync with the core directive registry. Product-specific directive families, including TTD protocol directives, belong in their owning modules.
- `ir.schema.json` – JSON Schema describing the Wesley IR representation.
- `evidence-map.schema.json` – JSON Schema for the evidence bundle map emitted by HOLMES/-SHIPME flows.
- `scores.schema.json` – JSON Schema for holmes `scores.json` output.

> [!note]
> When a schema evolves, update the corresponding validation logic/tests and regenerate fixtures so downstream consumers stay aligned.
