# Architecture

Wesley is a Cargo workspace of six crates plus one Node package. This page says
what each part owns and how a schema moves through them. It describes the code
as it is; for why a change was made, read the commit and the pull request.

## The pipeline

```text
GraphQL SDL
    │
    ├── wesley-core: lower ──────►  L1 IR  ──►  registry hash, schema diff
    │                                 │
    └── wesley-core: operations ──►  root operations
                                      │
        L1 IR + root operations ──────┤
                                      ├──►  wesley-emit-rust         models, bindings
                                      ├──►  wesley-emit-typescript   declarations, bindings
                                      └──►  wesley-emit-codec        codec plan
                                                   ├──►  LE-binary codecs in Rust
                                                   └──►  LE-binary codecs in TypeScript
```

The SDL is parsed twice. `lower_schema_sdl` produces the L1 IR.
`list_schema_operations_sdl` parses the same text again, independently, to list
the root operations; it does not read the IR. A change to lowering therefore
does not automatically change the operation list, and the two must be kept in
agreement by tests.

The emitters never see SDL. They take the IR and the operation list, which is
why two emitters cannot disagree about what a field is: neither of them parsed
it.

## The crates

| Crate                    | Published | Owns                                                  |
| ------------------------ | --------- | ----------------------------------------------------- |
| `wesley-core`            | yes       | Parsing, the L1 IR, hashing, diffing, operations, law |
| `wesley-emit-codec`      | yes       | The language-neutral plan for the LE-binary codecs    |
| `wesley-emit-rust`       | yes       | Rust output                                           |
| `wesley-emit-typescript` | yes       | TypeScript output                                     |
| `wesley-cli`             | yes       | The `wesley` binary                                   |
| `wesley-holmes`          | no        | Law-evidence checks; a library with no CLI of its own |

The published crates are versioned in lockstep and pin each other exactly
(`=X.Y.Z`), so a given `wesley-cli` always builds against the `wesley-core` it
was released with.

### wesley-core

The compiler kernel. It depends on none of the other crates.

- `adapters::apollo` parses SDL with `apollo-parser` and lowers it. The entry
  points are re-exported at the crate root: `lower_schema_sdl`,
  `normalize_schema_sdl`, `diff_schema_sdl`, `list_schema_operations_sdl`,
  `resolve_operation_selections`, and `extract_operation_directive_args`.
- `domain::ir` defines the L1 IR and the hashes: `compute_registry_hash` over an
  IR, `compute_content_hash` over text.
- `domain::schema_delta` classifies each difference between two schemas as safe
  or breaking.
- `domain::operation` and `domain::operation_artifact` describe root operations
  and the artifacts compiled from them.
- `domain::law` holds the law model behind the `wesley law` commands.
- `domain::project_manifest` reads `wesley.config.json` and its YAML forms.

The kernel is synchronous. An async `LoweringPort`, and a wrapper that adds a
cooperative timeout through the `ninelives` crate, sit behind the `resilience`
feature. That feature is on by default. With
`default-features = false` the crate compiles without `tokio`, `tower`,
`ninelives`, or `async-trait`, and `cargo xtask lean-core-check` fails the build
if any of them comes back.

Directives are lowered as data: a name and its arguments, attached to the type
or field they were written on. A directive the core does not know, such as
`@audited(level: 2)`, passes through unchanged and means whatever the tool that
reads the IR says it means.

The core does know a fixed set, and that set changes a schema's IR and hash:

- Eight families have aliases that are rewritten to one canonical name during
  lowering: `table`, `pk` (also `primaryKey`), `fk` (also `foreignKey`),
  `unique`, `index`, `tenant`, `default`, and `rls`. Each is accepted bare, as
  `wesley_<name>`, or as `wes_<name>`, and is recorded as `wes_<name>`. So
  `@table` and `@wes_table` lower to the same IR and the same hash. The list is
  `canonical_core_directive_name` in `adapters/apollo.rs`; the directives
  themselves are declared in `schemas/directives.graphql`.
- `@wes_channel` on an object type can be lowered into the law IR by
  `lower_wes_channel_directives_to_law_ir_v1`.

Beyond recording those names, the core attaches no database, runtime, or product
behavior to any directive.

### wesley-emit-codec

Lowers the IR to a plan for the little-endian binary codecs: which values are
scalars, enums, nested structs, options, or lists, and in what order. The Rust
and TypeScript emitters both consume this plan and decide only how to spell it
in their language, so the two cannot drift apart on the wire.

### wesley-emit-rust and wesley-emit-typescript

The model emitters build a syntax model of the output and print it.
`emit_rust` and `emit_typescript` take an IR. The
`..._with_operations` forms also take the root operations and add a request
type, a response type, and metadata for each.

### wesley-cli

Parses the command line, reads files, calls the libraries for the compiler
work, and prints the result. `wesley doctor` reports whether the pieces it needs are
present.

### wesley-holmes and packages/wesley-holmes

`crates/wesley-holmes` is a Rust library that validates law-evidence artifacts.
It is not published and adds no commands to `wesley`.

`packages/wesley-holmes` is the one remaining Node package. It provides the
`holmes` and `moriarty` commands used by this repository's own assurance
workflow. It is marked `legacy-compatibility` in its `package.json`, and
`cargo xtask docs-check` enforces that marking through
`xtask/node-retirement-ledger.json`.

## Repository layout

```text
crates/       the six Rust crates
packages/     wesley-holmes, the remaining Node package
schemas/      JSON Schemas for the artifacts Wesley reads and writes
test/         bats suites and fixtures
xtask/        repository automation: cargo xtask <command>
scripts/      Node and shell helpers used by the hooks and by CI
.github/      workflows, issue templates, the pull request template
.continuum/   the release profile
```

## Automation

`cargo xtask` is the entry point for everything a contributor or a workflow
runs: `preflight`, `docs-check`, `docs-replay`, `lean-core-check`,
`release-prep-guard`, `release-check`, `release-guard`, `release-autotag-plan`,
`package-crates`, and `publish-crates`. Run `cargo xtask help` for the list. [CI](ci.md) says which of
them run where, and [RELEASE.md](../RELEASE.md) covers the release commands.
