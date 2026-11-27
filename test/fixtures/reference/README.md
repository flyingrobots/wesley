# Reference Schema Fixture

A historical GraphQL SDL that exercises broad directive and alias coverage.
Useful for:

- Ad hoc experimentation (manual `wesley generate` runs)
- Parser/regression tests when you need a fully-populated schema
- Comparing directive coverage with the curated examples in `../examples`

This schema is not wired into CI by default and is not a current-path happy path. It uses wesley-postgres's database directives in their `@wes_*` spelling; the bare aliases it once used (`@table`, `@primaryKey`, ...) are no longer folded by the core and would be rejected undeclared.
