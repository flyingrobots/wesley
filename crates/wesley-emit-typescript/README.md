# wesley-emit-typescript

`wesley-emit-typescript` projects Wesley Level 1 IR into TypeScript declaration
artifacts using a structured emitter. It is the native TypeScript
code-generation surface for models and operation bindings derived from GraphQL
schema definitions.

## Emitter Boundary

TypeScript generation is a two-step pipeline:

1. Lower Wesley IR into a crate-local TypeScript syntax model.
2. Render that syntax model through the dedicated printer.

Semantic lowering must not interleave source string assembly with schema
walking. Raw `String` writes belong at the printer boundary only, where escaping,
identifier handling, property access, and formatting are centralized.

See the repository
[README](https://github.com/flyingrobots/wesley#readme) and
[architecture guide](https://github.com/flyingrobots/wesley/blob/main/docs/ARCHITECTURE.md)
for the full project context.
