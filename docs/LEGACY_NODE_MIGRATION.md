# LEGACY NODE MIGRATION

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is the deletion map for the historical Node Wesley surface.

The goal is not to port every file. The goal is to keep useful Wesley
capabilities while removing Node as a product entry point.
The active retirement campaign is tracked by
[design packet `0017`](./design/0017-rust-native-front-door-and-node-retirement/rust-native-front-door-and-node-retirement.md)
and its
[Node retirement ledger](./design/0017-rust-native-front-door-and-node-retirement/NODE_RETIREMENT_LEDGER.md).

The native Rust distribution path is crates.io: `cargo install wesley-cli`
installs the `wesley` binary. Sibling-repo paths and Node entrypoints are local
development or legacy compatibility surfaces, not release distribution.

## Rule

Every legacy Node surface gets one disposition:

| Disposition | Meaning                                                             |
| ----------- | ------------------------------------------------------------------- |
| Port        | Rebuild the useful behavior in Rust.                                |
| Extract     | Move the behavior to the owning repo or package family.             |
| Delete      | Remove it when nothing current depends on it.                       |
| Defer       | Keep temporarily because the owning Rust shape is not designed yet. |

## Command Inventory

| Legacy command        | Current file                                           | Disposition                 | Rust destination / exit                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate`            | `packages/wesley-cli/src/commands/generate.mjs`        | Port in pieces, then delete | Replace with native schema/operation/emit commands. Keep only while JS generators and evidence bundle flow still need it.                                                                                                                                       |
| `transform`           | `packages/wesley-cli/src/commands/transform.mjs`       | Delete                      | It is a compatibility wrapper around `generate`; do not recreate as a core noun unless the Rust transmutation model earns it.                                                                                                                                   |
| `compile`             | `packages/wesley-cli/src/commands/compile.mjs`         | Defer, then rebuild in Rust | Replace Node dynamic module target dispatch with a Rust target registry or external-process target protocol.                                                                                                                                                    |
| `typescript` / `ts`   | `packages/wesley-cli/src/commands/typescript.mjs`      | Partially ported            | Native `wesley emit typescript` now emits basic TypeScript declarations through `crates/wesley-emit-typescript`, a Rust AST/printer projection. Legacy generator parity is not complete yet.                                                                    |
| `zod`                 | `packages/wesley-cli/src/commands/zod.mjs`             | Port                        | Build a Rust Zod projection if Wesley still owns this generic output.                                                                                                                                                                                           |
| `models`              | `packages/wesley-cli/src/commands/models.mjs`          | Delete or extract           | Model-class scaffolding is not core compiler truth. Keep only if a Rust target module explicitly owns it.                                                                                                                                                       |
| `diff`                | `packages/wesley-cli/src/commands/diff.mjs`            | Ported                      | Native `wesley schema diff` now compares L1 schema structure in Rust, including Git-aware `--schema <path> --against <rev>` lookup. Argument-aware operation deltas remain a separate IR/API decision because L1 fields do not currently carry field arguments. |
| `init`                | `packages/wesley-cli/src/commands/init.mjs`            | Port small or delete        | A native `wesley init` is acceptable only as a tiny schema starter. Do not scaffold product conventions in core.                                                                                                                                                |
| `doctor`              | `packages/wesley-cli/src/commands/doctor.mjs`          | Port narrow                 | Rebuild only Rust-native health checks. Drop Node/plugin resolver checks once Node packages retire.                                                                                                                                                             |
| `validate-bundle`     | `packages/wesley-cli/src/commands/validate-bundle.mjs` | Defer                       | Port only if Rust evidence bundles remain a Wesley-owned surface. Otherwise extract to assurance tooling.                                                                                                                                                       |
| `runs`                | `packages/wesley-cli/src/commands/runs.mjs`            | Extract or defer            | Runtime ledger inspection is not needed for the compiler kernel. Move with Holmes/runtime evidence unless Rust assurance keeps it.                                                                                                                              |
| `cert-create`         | `packages/wesley-cli/src/commands/cert-create.mjs`     | Extract                     | SHIPME/certificate workflow belongs in assurance tooling, not the compiler kernel.                                                                                                                                                                              |
| `cert-sign` / `stake` | `packages/wesley-cli/src/commands/cert-sign.mjs`       | Extract                     | Move with certificate tooling if still needed.                                                                                                                                                                                                                  |
| `cert-verify`         | `packages/wesley-cli/src/commands/cert-verify.mjs`     | Extract                     | Move with certificate tooling if still needed.                                                                                                                                                                                                                  |
| `cert-badge`          | `packages/wesley-cli/src/commands/cert-badge.mjs`      | Extract or delete           | Only keep with certificate tooling.                                                                                                                                                                                                                             |

## Package Inventory

| Legacy package                          | Disposition                     | Notes                                                                                                      |
| --------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/wesley-core/`                 | Port then delete                | Audit for generic compiler behavior not already in `crates/wesley-core`; reject domain residue.            |
| `packages/wesley-cli/`                  | Delete after command migration  | Native `crates/wesley-cli` is the product body.                                                            |
| `packages/wesley-host-node/`            | Delete                          | Native binary replaces the Node host.                                                                      |
| `packages/wesley-runtime-node/`         | Extract or delete               | Node module loading should not define Wesley core.                                                         |
| `packages/wesley-generator-js/`         | Port useful projections         | Basic Rust and TypeScript model emission has started in Rust. Zod and legacy generator parity remain open. |
| `packages/wesley-generator-vue/`        | Delete or externalize           | Experimental frontend projection is not core.                                                              |
| `packages/wesley-holmes/`               | Extract or rebuild later        | Assurance/evidence tooling is adjacent, not a blocker for compiler-kernel Rustification.                   |
| `packages/wesley-host-browser/`         | Delete or externalize           | Browser host is an experiment, not the pure Rust path.                                                     |
| `packages/wesley-host-bun/`             | Delete                          | Host experiment.                                                                                           |
| `packages/wesley-host-deno/`            | Delete                          | Host experiment.                                                                                           |
| `packages/wesley-scaffold-multitenant/` | Delete or move to product owner | Product scaffold, not core Wesley.                                                                         |
| `packages/wesley-tasks/`                | Port only if generic            | Keep the idea only if Rust execution planning needs it.                                                    |
| `packages/wesley-test-fixtures/`        | Replace                         | Move useful fixtures into Rust tests or plain `test/fixtures`.                                             |

## Execution Order

1. Keep shipping Rust-native compiler facts through `crates/wesley-core` and
   `crates/wesley-cli`.
2. Port generic schema diff if it is still wanted. Done for L1 schema
   structure through `wesley schema diff`.
3. Port TypeScript/Zod only after deciding the Rust target boundary. Basic Rust
   and TypeScript model emission now live in Rust projection crates.
4. Replace Node `generate` with explicit Rust emit commands.
5. Remove Node host/runtime packages once no CLI command needs them.
6. Remove root `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` only
   after package, website, and legacy CI references are gone or externalized.

## Non-Goals

- Do not rebuild Node dynamic module loading in Rust just to preserve shape.
- Do not move Echo footprint honesty into Wesley core.
- Do not move Postgres migrations into Wesley core.
- Do not keep browser/Bun/Deno hosts in this repo for the pure Rust milestone.
