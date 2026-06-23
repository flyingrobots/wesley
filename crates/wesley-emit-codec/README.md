# wesley-emit-codec

`wesley-emit-codec` lowers Wesley Level 1 IR and selected operations into a
language-neutral LE-binary codec plan.

The crate is intentionally not a source printer. It defines the shared codec
shape consumed by language-specific emitters such as `wesley-emit-rust` and
`wesley-emit-typescript`, so those emitters do not each re-derive enum, object,
list, nullable, and operation-variable codec behavior.

## Boundary

The plan layer owns codec semantics:

- which GraphQL structs need codec definitions
- scalar-to-wire-kind selection
- list and nullable wrapper structure
- operation variable request shape
- output object versus input object labels

Language emitters still own their generated source shape, names, imports,
runtime adapter calls, and formatting.

See the repository
[README](https://github.com/flyingrobots/wesley#readme) and
[architecture guide](https://github.com/flyingrobots/wesley/blob/main/docs/ARCHITECTURE.md)
for the full project context.
