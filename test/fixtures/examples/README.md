# Examples Fixture Set

Canonical schemas used by documentation, HOLMES tests, and CLI walkthroughs.

Directive support truth lives in
[`docs/DIRECTIVES.md`](../../../docs/DIRECTIVES.md). Fixtures in this directory
are split by whether they are current-path examples or experimental/historical
coverage.

## Stable Current-Path Fixtures

These fixtures must use only directive families marked `current` in
`docs/DIRECTIVES.md`.

- `schema.graphql` – Minimal schema used by HOLMES smoke tests.
- `schema-v2.graphql` – Evolution of the minimal schema.
- `ecommerce.graphql` – Quick-start and example generation schema.

## Experimental Or Historical Fixtures

These fixtures exercise broader ideas and must not be cited as the default
compiler support surface.

- `schema-with-rls.graphql` – Historical broad RLS option example.
- `multi-tenant.graphql` – Historical tenant/owner/policy example.
- `rpc-example.graphql` – Historical RPC and ownership sketch.

## Consuming Tests

- `test/holmes-e2e.bats` copies `schema.graphql` when generating evidence bundles.

When updating schemas, ensure docs, fixture docs, and any snapshot tests are
updated accordingly.
