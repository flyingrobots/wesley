# Parser Design (Internals)

Goal: map GraphQL SDL into a domain schema model for generators.

Principles
- Schema‑first: directives encode DB semantics close to fields/types.
- Lossless: preserve enough info for round‑trip and rich generation.
- Portable: core parser avoids platform dependencies.

Outline
- Tokenize/parse SDL (GraphQL reference parser) → AST.
- Visit types/fields and collect directives into domain objects (Table, Field, Relations, Indexes, Policies).
- Normalize directives to canonical `@wes_*` forms and record legacy aliases.
- Produce a Schema object consumed by analyzers/generators.

See also: docs/guides/quick-start.md for directive examples.

