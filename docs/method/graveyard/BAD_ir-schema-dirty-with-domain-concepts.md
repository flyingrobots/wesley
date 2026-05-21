# Retired: IR schema dirty with domain concepts

## What was retired

The ASAP backlog item `BAD_ir-schema-dirty-with-domain-concepts.md` was
retired.

## Why

The card's current-state claim is false. `schemas/ir.schema.json` is now titled
"Wesley Domain-Empty Canonical IR" and describes `types`, `fields`,
`TypeReference`, and generic directive maps. It no longer defines top-level
`Table`, `Index`, `ForeignKey`, `RLSConfig`, or `TenantConfig` concepts.

## Reopen condition

Reopen only if new tracked schema evidence reintroduces target-specific IR
concepts into the canonical Wesley IR schema.
