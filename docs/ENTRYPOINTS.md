# ENTRYPOINTS

<!-- docs-truth: status=experimental owner=@flyingrobots -->

Wesley has one intended front door:

```bash
cargo wesley --help
```

For published alpha builds, the crates.io package is `wesley-cli` and the
installed command is `wesley`. The `0.1.0` install command is valid after the
tag-driven release workflow publishes that version:

```bash
cargo install wesley-cli --version 0.1.0
wesley --help
```

The native command is now the first user-facing Rust surface for compiler facts.
The deeper source of truth is still the Rust library under `crates/wesley-core`.
New compiler behavior should start there, then grow a native CLI command when it
needs one.

The retired Node compiler packages are no longer a second Wesley. JavaScript
remains for Holmes assurance, website/docs tooling, repository scripts, and host
smoke experiments outside compiler authority. The migration map lives in
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
| Host smoke experiments  | `packages/wesley-host-*`              | Non-compiler packages               | Browser, Bun, and Deno smoke adapters with local parser/hash behavior.                                                                                                                                                                        |
| Root Node workspace     | `package.json`, `pnpm-workspace.yaml` | Workspace plumbing                  | Keeps retained JS packages, docs checks, package tests, and website tooling installable. It is not the Wesley product entry point.                                                                                                            |

## What Rust Wesley Does Today

Rust Wesley is the emerging compiler kernel.

It can:

- parse and lower GraphQL SDL into the L1 semantic IR
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
  identity, generator version, execution mode, and optional law bundle hashes
- run narrow Rust-native health checks without inspecting legacy Node config,
  plugins, or package state
- scaffold, lint, validate, diff, explain, rebind, and report coverage for
  `weslaw/v1` documents
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
wesley init-law --schema <path> --family <name> [--out <path>]
wesley law lint --law <law.weslaw.yaml> [--json]
wesley law validate --schema <schema.graphql> --law <law.weslaw.yaml> [--json]
wesley law diff --old <old.weslaw.yaml> --new <new.weslaw.yaml> [--schema <path>] [--format markdown|json|summary]
wesley law explain --law <law.weslaw.yaml> <subject> [--json]
wesley law rebind --schema <path> --law <law.weslaw.yaml> [--accept --out <path>] [--json]
wesley law capabilities --law <law.weslaw.yaml> [--json]
wesley law coverage --schema <path> --law <law.weslaw.yaml> [--profile release|ci-release|local] [--json]
wesley emit rust --schema <path> --out <path> [--law <path>] [--metadata-out <path>]
wesley emit typescript --schema <path> --out <path> [--law <path>] [--metadata-out <path>]
wesley emit le-binary-rust --schema <path> --out <path> [--law <path>] [--metadata-out <path>] [--codec-import <path>]
wesley emit le-binary-typescript --schema <path> --out <path> [--law <path>] [--metadata-out <path>] [--codec-import <path>]
wesley operation selections --operation <path> [--schema <path>] [--json]
wesley operation directive-args --operation <path> --directive <name> --json
```

## What JavaScript Does Today

JavaScript is supporting tooling, not compiler authority.

It can still run workflows such as:

- package preflight and package tests
- Holmes/Moriarty evidence tooling
- browser/Bun/Deno host smoke experiments
- website and docs-support tooling

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
- **Non-compiler JS surfaces**: `packages/`, kept only for assurance, host
  smoke experiments, or package-maintenance value

Any document or workflow that presents `pnpm wesley` as Wesley's main command
surface is stale by default.

If an old script still calls `pnpm wesley`, it should be deleted or rewritten.
Generic schema work should use:

| Legacy call                              | Native path                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm wesley diff <old> <new>`           | `wesley schema diff --old <old> --new <new>`                                       |
| `pnpm wesley doctor`                     | `wesley doctor`                                                                    |
| `pnpm wesley typescript --schema <path>` | `wesley emit typescript --schema <path> --out <path>`                              |
| `pnpm wesley generate --schema <path>`   | `wesley emit rust ...`, `wesley emit typescript ...`, or an external target owner  |
