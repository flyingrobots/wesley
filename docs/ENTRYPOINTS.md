# ENTRYPOINTS

<!-- docs-truth: status=experimental owner=@flyingrobots -->

Wesley has one intended front door:

```bash
cargo run --bin wesley -- --help
```

For published alpha builds, the crates.io package is `wesley-cli` and the
installed command is `wesley`. The `v0.2.0` release installs as:

```bash
cargo install wesley-cli --version 0.2.0
wesley --help
```

Use [Topics](./topics/README.md) when you know the task and need the shortest
current route to the right command, workflow, or boundary document.

The native command is now the first user-facing Rust surface for compiler facts.
The deeper source of truth is still the Rust library under `crates/wesley-core`.
New compiler behavior should start there, then grow a native CLI command when it
needs one.

For command usage and options, read the
[CLI Reference](./reference/cli.md).

The retired Node compiler packages are no longer a second Wesley. JavaScript
remains for Holmes assurance, docs tooling, and repository scripts outside
compiler authority. The old product website/playground surface and the
browser/Bun/Deno host experiments are retired from the Wesley release surface.
The migration map lives in
[LEGACY_NODE_MIGRATION.md](./LEGACY_NODE_MIGRATION.md).

## What Lives Where

| Surface                 | Path                                  | Status                              | What it does                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust compiler kernel    | `crates/wesley-core/`                 | Canonical for new compiler work     | Lowers GraphQL SDL into domain-empty L1 IR; diffs L1 schema structure; lists schema root operations; resolves operation selections; extracts directive arguments.                                                                             |
| Native Wesley command   | `crates/wesley-cli/`                  | Rust product CLI                    | Provides Rust-native health checks, SDL normalization, schema lowering, schema hashing, schema operation listing, schema diffing, Rust/TypeScript emission, operation selection analysis, and directive argument extraction from Rust crates. |
| Shared codec planner    | `crates/wesley-emit-codec/`           | Rust projection support crate       | Lowers L1 IR and selected schema operations into a language-neutral LE-binary codec plan consumed by Rust and TypeScript codec emitters.                                                                                                      |
| Rust model emitter      | `crates/wesley-emit-rust/`            | Rust projection crate               | Emits Rust data models and root operation request/response bindings from Wesley L1 IR plus `SchemaOperation` data through a structured Rust item/type AST and printer.                                                                        |
| Rust TypeScript emitter | `crates/wesley-emit-typescript/`      | Rust projection crate               | Emits TypeScript declarations, root operation request/response bindings, and operation metadata constants from Wesley L1 IR plus `SchemaOperation` data through a structured TypeScript declaration AST and printer.                          |
| Repo automation         | `xtask/`                              | Current Rust maintenance front door | Runs docs checks, Rust tests, native preflight, release checks, and the JavaScript package preflight bridge.                                                                                                                                  |
| Assurance tooling       | `packages/wesley-holmes/`             | Non-compiler package                | Holmes/Moriarty-era evidence, verification, reporting, runtime-run inspection, and counterfactual tooling.                                                                                                                                    |
| Root Node workspace     | `package.json`, `pnpm-workspace.yaml` | Workspace plumbing                  | Keeps retained JS packages, docs checks, package tests, and docs tooling installable. It is not the Wesley product entry point.                                                                                                               |

## What Rust Wesley Does Today

Rust Wesley is the emerging compiler kernel.

It can:

- parse and lower GraphQL SDL into domain-empty L1 IR
- consolidate `extend type` blocks before lowering
- print a normalized SDL view of Rust compiler facts and its SHA-256 evidence
  hash
- compute stable canonical JSON and hashes for L1 IR
- compute structural L1 schema deltas
- list schema root operations with arguments, result types, and directives
- emit Rust data models and operation bindings through a Rust AST/printer path
- emit TypeScript declarations and operation bindings through a Rust AST/printer path
- emit Rust and TypeScript little-endian codec helpers from a shared codec plan
- write deterministic emit metadata sidecars with schema hash, generator
  identity, generator version, and execution mode
- run narrow Rust-native health checks without inspecting legacy Node config,
  plugins, or package state
- resolve GraphQL operation selection paths
- resolve schema-coordinate selections when schema SDL is available
- extract arbitrary operation directive arguments as data

The native CLI exposes those facts through:

```bash
wesley doctor
wesley doctor --json
wesley normalize-sdl --schema <path>
wesley normalize-sdl --schema <path> --hash
wesley schema lower --schema <path> --json
wesley schema hash --schema <path>
wesley schema operations --schema <path> --json
wesley schema diff --old <path> --new <path> [--format text|json|summary] [--exit-code]
wesley schema diff --schema <path> --against <rev> [--format text|json|summary] [--exit-code]
wesley emit rust --schema <path> --out <path> [--metadata-out <path>]
wesley emit typescript --schema <path> --out <path> [--metadata-out <path>]
wesley emit le-binary-rust --schema <path> --out <path> [--metadata-out <path>] [--codec-import <path>]
wesley emit le-binary-typescript --schema <path> --out <path> [--metadata-out <path>] [--codec-import <path>]
wesley operation selections --operation <path> [--schema <path>] [--json]
wesley operation directive-args --operation <path> --directive <name> --json
```

## What JavaScript Does Today

JavaScript is supporting tooling, not compiler authority.

It can still run workflows such as:

- package preflight and package tests
- Holmes/Moriarty evidence tooling
- docs-support tooling

Holmes/Moriarty, run-ledger, and package-evidence commands are assurance
surfaces. They are not native compiler-front-door commands, and new Rust
compiler work should not depend on them.

## Retired Surfaces

| Former surface                   | Outcome  | Replacement / owner                                                                                |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `packages/wesley-core/`          | Deleted  | Rust crates own retained compiler authority.                                                       |
| `packages/wesley-cli/`           | Deleted  | The Rust CLI owns the product front door.                                                          |
| `packages/wesley-host-node/`     | Deleted  | No retained workflow shells through the old Node executable wrapper.                               |
| `packages/wesley-runtime-node/`  | Deleted  | Holmes-local support owns retained ledger and module capability helpers.                           |
| `packages/wesley-host-browser/`  | Deleted  | Browser execution is not a supported Wesley release surface.                                       |
| `packages/wesley-host-bun/`      | Deleted  | Bun execution is not a supported Wesley release surface.                                           |
| `packages/wesley-host-deno/`     | Deleted  | Deno execution is not a supported Wesley release surface.                                          |
| `packages/wesley-generator-js/`  | Deleted  | Generic TypeScript output belongs in Rust emitters; Zod is CLI-local compatibility debt.           |
| `packages/wesley-generator-vue/` | Deleted  | Vue projection behavior belongs in an external target module or product owner, not generic Wesley. |
| JS/Rust parity release authority | Archived | Rust self-consistency and native fixture truth are the product release gate.                       |

## How To Choose

| If you are doing this                                                 | Use this                                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Adding or changing compiler semantics                                 | `crates/wesley-core/`                                                  |
| Adding a user-facing Wesley command                                   | `crates/wesley-cli/`                                                   |
| Running Rust health checks                                            | `cargo xtask preflight`                                                |
| Checking docs links/truth/local-path hygiene                          | `cargo xtask docs-check`                                               |
| Preparing native release artifacts                                    | `cargo xtask release-check`                                            |
| Touching retained JS packages, pnpm workspace files, or package tests | `cargo xtask legacy-preflight`                                         |
| Using an old generator that only exists in JS                         | Externalize it to its owning module or port it to Rust                 |
| Implementing Echo footprint honesty                                   | Echo-owned tooling, not generic Wesley                                 |
| Implementing Postgres migrations or SQL projection                    | `wesley-postgres` or another external target module, not `wesley-core` |

## Crates.io Alpha Packages

The crates.io alpha package set is intentionally small:

- `wesley-core`: compiler kernel library
- `wesley-emit-codec`: shared LE-binary codec planning crate
- `wesley-emit-rust`: Rust projection crate
- `wesley-emit-typescript`: TypeScript projection crate
- `wesley-cli`: installable CLI package that provides the `wesley` binary

The bare crate name `wesley` is already occupied on crates.io, so the product
binary ships through the `wesley-cli` package.

## Migration Rule

There should be one brain and one body:

- **Brain**: `crates/wesley-core`
- **Body**: `crates/wesley-cli`
- **Non-compiler JS surfaces**: `packages/`, kept only for assurance or
  package-maintenance value

Any document or workflow that presents `pnpm wesley` as Wesley's main command
surface is stale by default.

If an old script still calls `pnpm wesley`, it should be deleted or rewritten.
Generic schema work should use:

| Legacy call                              | Native path                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm wesley diff <old> <new>`           | `wesley schema diff --old <old> --new <new>`                                      |
| `pnpm wesley doctor`                     | `wesley doctor`                                                                   |
| `pnpm wesley typescript --schema <path>` | `wesley emit typescript --schema <path> --out <path>`                             |
| `pnpm wesley generate --schema <path>`   | `wesley emit rust ...`, `wesley emit typescript ...`, or an external target owner |
