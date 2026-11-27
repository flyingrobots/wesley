# Examples Fixture Set

Canonical schemas used by documentation, HOLMES tests, and CLI walkthroughs.

Fixtures in this directory are split by whether they are current-path examples
or experimental and historical coverage.

## Stable Current-Path Fixtures

These fixtures use only wesley-postgres's eight database directives: `@wes_table`, `@wes_pk`, `@wes_fk`, `@wes_unique`, `@wes_index`, `@wes_tenant`, `@wes_default`, and `@wes_rls`. The core gives them no meaning; it records them as written, and accepts them undeclared because they are in the reserved `wes_` namespace ([the architecture page](../../../docs/architecture.md) has the rules). A fixture that uses any other directive belongs in the next section.

[`schemas/directives.graphql`](../../../schemas/directives.graphql) declares
more directives than these. It is a registry of names, not a statement of
support, so a directive appearing there does not qualify a fixture as stable.

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
