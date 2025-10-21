# Examples Fixture Set

Canonical schemas used by documentation, HOLMES tests, and CLI walkthroughs.

## Files

- `schema.graphql` – Minimal schema used by HOLMES and quick-start docs.
- `schema-v2.graphql` – Evolution of the minimal schema (adds fields/indexes).
- `schema-with-rls.graphql` – Focused RLS example.
- `multi-tenant.graphql` – Demonstrates tenant/owner directives.
- `rpc-example.graphql` – Showcases experimental RPC directives.
- `ops/` – JSON operation plans consumed by the QIR `--ops` path.
- `tests/` – Generated pgTAP snapshots for QIR smoke checks (`ops.pgtap.sql`).

## Consuming Tests

- `test/holmes-e2e.bats` copies `schema.graphql` when generating evidence bundles.
- CLI/QIR examples in docs reference this directory; keep paths stable.

When updating schemas, ensure docs, fixtures manifest, and any snapshot tests are updated accordingly.
