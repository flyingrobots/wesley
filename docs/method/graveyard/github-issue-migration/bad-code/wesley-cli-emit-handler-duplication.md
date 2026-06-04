<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# `wesley emit <target>` handlers are copy-paste

Status: bad code.

## Where

`crates/wesley-cli/src/main.rs` — `run_emit_command`.

## Smell

Each emit target (`rust`, `typescript`, `le-binary-typescript` as of
2026-05-28) is a 20–30 line `match` arm that does the same shape:

1. Parse options
2. Read schema SDL
3. `lower_schema_sdl` + `list_schema_operations_sdl`
4. Optional law bundle load
5. Call the target's emit function
6. Write output
7. Write emit metadata sidecar

Adding `emit le-binary-typescript` in this session meant copy-pasting
the `emit typescript` arm and changing four lines. The next emit
target (e.g., `emit fixture-vectors-json`, `emit zod`,
`emit le-binary-rust`) will pay the same cost.

## Why it matters

`wesley-cli/src/main.rs` is already 2200+ lines and growing. Each new
emit target adds:

- A 25-line handler in `run_emit_command`
- A line in `print_emit_help`
- Possibly a new option in `ParsedOptions` (e.g., `--codec-import`)
- Possibly a new branch in `parse_options`

That's four places to remember per new target.

## Suggested refactor

Introduce an `EmitTarget` trait or struct registry:

```rust
struct EmitTarget {
    name: &'static str,
    options: &'static [EmitOption], // declarative
    run: fn(&Ir, &[SchemaOperation], &EmitOptions) -> String,
    generator_name: &'static str,
    generator_version: &'static str,
}

const EMIT_TARGETS: &[EmitTarget] = &[
    EmitTarget { name: "rust", ... },
    EmitTarget { name: "typescript", ... },
    EmitTarget { name: "le-binary-typescript", ... },
];
```

`run_emit_command` becomes a single 20-line dispatch over the
registry. `print_emit_help` iterates the same registry. New targets
are one declarative entry.

## Surface when

Adding a 4th emit target (likely `le-binary-rust` to mirror the TS
side, or `fixture-vectors-json` per the cool-idea card).
