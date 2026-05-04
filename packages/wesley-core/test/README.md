# Wesley Core Tests

The core package test suite covers generic compiler, evidence, module,
transmutation, and runtime-event behavior.

Run the package suite from the repository root:

```bash
pnpm --filter @wesley/core test
```

Useful focused variants:

```bash
pnpm --filter @wesley/core test:unit
pnpm --filter @wesley/core test:integration
pnpm --filter @wesley/core test:property
pnpm --filter @wesley/core test:fuzz
```

Database-specific generators, migration tests, PostgreSQL fixtures, and QIR SQL
emission tests live in `wesley-postgres`.
