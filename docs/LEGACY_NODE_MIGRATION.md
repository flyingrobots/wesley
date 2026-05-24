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

## If You Still Call `pnpm wesley`

`pnpm wesley` is the historical Node wrapper. Keep it only for commands that
have not yet moved or exited. Generic compiler work should move to the native
binary:

| Old call                                 | Replacement                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm wesley diff <old> <new>`           | `wesley schema diff --old <old> --new <new>`                                       |
| `pnpm wesley doctor`                     | `wesley doctor`                                                                    |
| `pnpm wesley generate --schema <path>`   | `wesley emit rust ...`, `wesley emit typescript ...`, or an external module target |
| `pnpm wesley typescript --schema <path>` | `wesley emit typescript --schema <path> --out <path>`                              |

Commands such as `cert-*`, `runs`, `validate-bundle`, `zod`, and Holmes-family
flows are not native compiler-front-door commands. They remain compatibility or
assurance surfaces until explicitly extracted, rebuilt, or deleted.

## Rule

Every legacy Node surface gets one disposition:

| Disposition | Meaning                                                             |
| ----------- | ------------------------------------------------------------------- |
| Port        | Rebuild the useful behavior in Rust.                                |
| Extract     | Move the behavior to the owning repo or package family.             |
| Delete      | Remove it when nothing current depends on it.                       |
| Defer       | Keep temporarily because the owning Rust shape is not designed yet. |

## Command Inventory

| Legacy command        | Current file                                           | Disposition                      | Rust destination / exit                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate`            | `packages/wesley-cli/src/commands/generate.mjs`        | Port generic pieces, then delete | Replace with native schema/operation/emit commands plus external modules. Keep only while JS generators and evidence bundle flow still need it.                                                                                                                 |
| `transform`           | `packages/wesley-cli/src/commands/transform.mjs`       | Delete                           | It is a compatibility wrapper around `generate`; do not recreate as a core noun unless the Rust transmutation model earns it.                                                                                                                                   |
| `compile`             | `packages/wesley-cli/src/commands/compile.mjs`         | Defer, then rebuild in Rust      | Replace Node dynamic module target dispatch with a Rust target registry or external-process target protocol.                                                                                                                                                    |
| `typescript` / `ts`   | `packages/wesley-cli/src/commands/typescript.mjs`      | Partially ported                 | Native `wesley emit typescript` now emits basic TypeScript declarations through `crates/wesley-emit-typescript`, a Rust AST/printer projection. Legacy generator parity is not complete yet.                                                                    |
| `zod`                 | `packages/wesley-cli/src/commands/zod.mjs`             | Extract                          | Zod is JavaScript validation output, not core compiler truth. Reintroduce it through an external target module or package if a consumer needs it.                                                                                                               |
| `models`              | `packages/wesley-cli/src/commands/models.mjs`          | Retire from core                 | Model-class scaffolding is not core compiler truth. Keep richer model classes only if a target module explicitly owns them.                                                                                                                                     |
| `diff`                | `packages/wesley-cli/src/commands/diff.mjs`            | Ported                           | Native `wesley schema diff` now compares L1 schema structure in Rust, including Git-aware `--schema <path> --against <rev>` lookup. Argument-aware operation deltas remain a separate IR/API decision because L1 fields do not currently carry field arguments. |
| `init`                | `packages/wesley-cli/src/commands/init.mjs`            | Retire legacy scaffolding        | A future native `wesley init` is acceptable only as a tiny schema starter and must be designed as new work. Do not port product conventions into core.                                                                                                          |
| `doctor`              | `packages/wesley-cli/src/commands/doctor.mjs`          | Port narrow                      | Rebuild only Rust-native health checks. Drop Node/plugin resolver checks once Node packages retire.                                                                                                                                                             |
| `validate-bundle`     | `packages/wesley-cli/src/commands/validate-bundle.mjs` | Assurance boundary               | Keep compatibility-only until evidence bundle validation moves beside assurance tooling.                                                                                                                                                                        |
| `runs`                | `packages/wesley-cli/src/commands/runs.mjs`            | Assurance/runtime boundary       | Runtime ledger inspection is not needed for the compiler kernel. Move with Holmes/runtime evidence; do not add a native compiler command.                                                                                                                       |
| `cert-create`         | `packages/wesley-cli/src/commands/cert-create.mjs`     | Assurance boundary               | SHIPME/certificate workflow belongs in assurance tooling, not the compiler kernel.                                                                                                                                                                              |
| `cert-sign` / `stake` | `packages/wesley-cli/src/commands/cert-sign.mjs`       | Assurance boundary               | Move with certificate tooling if still needed.                                                                                                                                                                                                                  |
| `cert-verify`         | `packages/wesley-cli/src/commands/cert-verify.mjs`     | Assurance boundary               | Move with certificate tooling if still needed.                                                                                                                                                                                                                  |
| `cert-badge`          | `packages/wesley-cli/src/commands/cert-badge.mjs`      | Assurance boundary or delete     | Only keep with certificate tooling.                                                                                                                                                                                                                             |

## Package Inventory

| Legacy package                          | Disposition                     | Notes                                                                                                                   |
| --------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/wesley-core/`                 | Port then delete                | Audit for generic compiler behavior not already in `crates/wesley-core`; reject domain residue.                         |
| `packages/wesley-cli/`                  | Delete after command migration  | Native `crates/wesley-cli` is the product body.                                                                         |
| `packages/wesley-host-node/`            | Delete                          | Legacy compatibility only; native binary replaces the Node host as product front door.                                  |
| `packages/wesley-runtime-node/`         | Extract or delete               | Node module loading should not define Wesley core.                                                                      |
| `packages/wesley-generator-js/`         | Port TypeScript, extract Zod    | Basic Rust and TypeScript model emission has started in Rust. Zod exits to an external target boundary if still needed. |
| `packages/wesley-holmes/`               | Extract or rebuild later        | Assurance/evidence tooling is adjacent, not a blocker for compiler-kernel Rustification.                                |
| `packages/wesley-host-browser/`         | Delete or externalize           | Legacy compatibility only; externalize if browser ecosystem ownership remains useful.                                   |
| `packages/wesley-host-bun/`             | Delete                          | Legacy compatibility only; delete or externalize after compatibility evidence is obsolete.                              |
| `packages/wesley-host-deno/`            | Delete                          | Legacy compatibility only; delete or externalize after compatibility evidence is obsolete.                              |
| `packages/wesley-scaffold-multitenant/` | Delete or move to product owner | Product scaffold, not core Wesley.                                                                                      |
| `packages/wesley-tasks/`                | Port only if generic            | Keep the idea only if Rust execution planning needs it.                                                                 |
| `packages/wesley-test-fixtures/`        | Replace                         | Move useful fixtures into Rust tests or plain `test/fixtures`.                                                          |

## Retired Package Inventory

| Legacy package                   | Slice  | Outcome | Replacement / owner                                                                                  |
| -------------------------------- | ------ | ------- | ---------------------------------------------------------------------------------------------------- |
| `packages/wesley-generator-vue/` | NR-081 | Deleted | Vue output is no longer generic Wesley surface area; reintroduce it only through an external target. |

## Execution Order

1. Keep shipping Rust-native compiler facts through `crates/wesley-core` and
   `crates/wesley-cli`.
2. Port generic schema diff if it is still wanted. Done for L1 schema
   structure through `wesley schema diff`.
3. Keep TypeScript in the Rust projection crate and move Zod to an external
   target boundary if consumers still need it.
4. Replace Node `generate` with explicit Rust emit commands:
   `wesley emit rust --schema <path> --out <path>` and
   `wesley emit typescript --schema <path> --out <path>`.
5. Keep browser/Bun/Deno/Node host packages in explicitly named legacy
   compatibility CI lanes only while their deletion or externalization gates
   remain open.
6. Remove root `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` only
   after package, website, and legacy CI references are gone or externalized.

## Non-Goals

- Do not rebuild Node dynamic module loading in Rust just to preserve shape.
  The replacement is a Rust target registry plus an explicit WASM or
  external-process capability protocol.
- Do not move Echo footprint honesty into Wesley core.
- Do not move Postgres migrations into Wesley core.
- Do not keep browser/Bun/Deno hosts in this repo for the pure Rust milestone.
