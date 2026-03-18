# Negative Ops Fixtures

These files are intentionally paired with the wrong schema so the CLI has a
stable, explicit compile-failure fixture.

- Use with `test/fixtures/examples/schema.graphql`
- Expect `wesley generate --ops ...` to fail during ops compilation
- Do not repurpose this directory as a happy-path example

The positive example set remains `test/fixtures/examples/ops/`, which is meant
to be paired with `test/fixtures/examples/ecommerce.graphql`.
