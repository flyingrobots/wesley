# Reference Schema Fixture

A historical GraphQL SDL that exercises broad directive and alias coverage.
Useful for:

- Ad hoc experimentation (manual `wesley generate` runs)
- Parser/regression tests when you need a fully-populated schema
- Comparing directive coverage with the curated examples in `../examples`

This schema is not wired into CI by default and is not a current-path happy
path. Do not copy its legacy aliases into user-facing docs without checking
`docs/DIRECTIVES.md`.
