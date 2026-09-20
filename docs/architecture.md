# Architecture

Wesley is a Cargo workspace of six crates plus one Node package. This page says
what each part owns and how a schema moves through them. It describes the code
as it is; for why a change was made, read the commit and the pull request.

## The pipeline

```text
GraphQL SDL
    │  wesley-core: parse, lower
    ▼
L1 IR  ──►  registry hash, operation list, schema diff
    │
    ├──►  wesley-emit-rust         Rust models and operation bindings
    ├──►  wesley-emit-typescript   TypeScript declarations and bindings
    └──►  wesley-emit-codec        codec plan
                 ├──►  wesley-emit-rust         LE-binary codecs in Rust
                 └──►  wesley-emit-typescript   LE-binary codecs in TypeScript
```

Everything downstream reads the L1 IR. Nothing downstream reads SDL. That is
what makes the outputs agree with each other: two emitters cannot disagree about
what a field is, because neither of them parsed it.

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

Directives in a schema are lowered as data: a name and its arguments, attached
to the type or field they were written on. The core does not interpret them. A
directive means whatever the tool that reads the IR says it means.

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
