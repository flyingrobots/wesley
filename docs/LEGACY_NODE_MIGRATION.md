# LEGACY NODE MIGRATION

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is the final deletion map for the historical Node Wesley surface.

The goal is not to port every file. The goal is to keep useful Wesley
capabilities while removing Node as a product entry point.
The active retirement campaign is tracked by
[design packet `0017`](./design/0017-rust-native-front-door-and-node-retirement/rust-native-front-door-and-node-retirement.md)
and its
[Node retirement ledger](./design/0017-rust-native-front-door-and-node-retirement/NODE_RETIREMENT_LEDGER.md).

The native Rust distribution path is crates.io: `cargo install wesley-cli`
installs the `wesley` binary. Sibling-repo paths and JavaScript entrypoints are
local development, assurance, or host-experiment surfaces, not release
distribution.

## If You Still Call `pnpm wesley`

`pnpm wesley` was the historical Node wrapper. It is now retired. Rewrite
callers to the native binary or to the owning external module:

| Old call                                 | Replacement                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm wesley diff <old> <new>`           | `wesley schema diff --old <old> --new <new>`                                       |
| `pnpm wesley doctor`                     | `wesley doctor`                                                                    |
| `pnpm wesley generate --schema <path>`   | `wesley emit rust ...`, `wesley emit typescript ...`, or an external module target |
| `pnpm wesley typescript --schema <path>` | `wesley emit typescript --schema <path> --out <path>`                              |

Commands such as `cert-*`, `runs`, `validate-bundle`, and `zod` were not
native compiler-front-door commands and were not ported as generic Wesley
nouns. Holmes-family flows live in `@wesley/holmes`, and any future Zod,
certificate, or runtime-ledger surface must be designed in its owning package or
module.

## Rule

Every legacy Node surface gets one disposition:

| Disposition | Meaning                                                             |
| ----------- | ------------------------------------------------------------------- |
| Port        | Rebuild the useful behavior in Rust.                                |
| Extract     | Move the behavior to the owning repo or package family.             |
| Delete      | Remove it when nothing current depends on it.                       |
| Defer       | Keep temporarily because the owning Rust shape is not designed yet. |

## Command Inventory

| Legacy command        | Final disposition      | Replacement / owner                                                                                                                  |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `generate`            | Deleted                | Native `wesley schema lower`, `wesley emit rust`, `wesley emit typescript`, and external modules for non-generic targets.            |
| `transform`           | Deleted                | No direct replacement. Reintroduce only if a Rust transmutation model earns a first-class noun.                                      |
| `compile`             | Deleted                | Use the Rust CLI for generic compiler work. Domain target dispatch belongs to external modules or a future explicit target protocol. |
| `typescript` / `ts`   | Ported then deleted    | `wesley emit typescript --schema <path> --out <path>` through `crates/wesley-emit-typescript`.                                       |
| `zod`                 | Deleted                | Future JavaScript validation output belongs to an external target module or package.                                                 |
| `models`              | Deleted                | Model-class scaffolding is not generic compiler truth.                                                                               |
| `diff`                | Ported then deleted    | `wesley schema diff --old <old> --new <new>` and `wesley schema diff --schema <path> --against <rev>`.                               |
| `init`                | Deleted                | A future native `wesley init` must be designed as new Rust work.                                                                     |
| `doctor`              | Ported then deleted    | `wesley doctor` for Rust-native health checks.                                                                                       |
| `validate-bundle`     | Deleted                | Evidence bundle validation belongs beside assurance tooling if retained.                                                             |
| `runs`                | Extracted then deleted | Holmes-local ledger support owns retained run inspection helpers.                                                                    |
| `cert-create`         | Deleted                | SHIPME/certificate behavior belongs to assurance tooling, not the compiler kernel.                                                   |
| `cert-sign` / `stake` | Deleted                | Rebuild only in a certificate-specific package if still needed.                                                                      |
| `cert-verify`         | Deleted                | Rebuild only in a certificate-specific package if still needed.                                                                      |
| `cert-badge`          | Deleted                | Rebuild only in a certificate-specific package if still needed.                                                                      |

## Package Inventory

| Package                         | Final disposition     | Notes                                                                                   |
| ------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `packages/wesley-core/`         | Deleted               | Generic compiler authority now lives in `crates/wesley-core`.                           |
| `packages/wesley-cli/`          | Deleted               | Native `crates/wesley-cli` is the product body.                                         |
| `packages/wesley-host-node/`    | Deleted               | The old Node wrapper is gone; product work uses the Rust binary.                        |
| `packages/wesley-runtime-node/` | Deleted               | Retained ledger/module helpers were copied into Holmes support modules before deletion. |
| `packages/wesley-holmes/`       | Retained as assurance | Holmes is not compiler authority and must stay self-contained.                          |
| `packages/wesley-host-browser/` | Deleted               | Browser execution is not a supported Wesley release surface.                            |
| `packages/wesley-host-bun/`     | Deleted               | Bun execution is not a supported Wesley release surface.                                |
| `packages/wesley-host-deno/`    | Deleted               | Deno execution is not a supported Wesley release surface.                               |

## Retired Package Inventory

| Legacy package                          | Slice  | Outcome | Replacement / owner                                                                                  |
| --------------------------------------- | ------ | ------- | ---------------------------------------------------------------------------------------------------- |
| `packages/wesley-generator-vue/`        | NR-081 | Deleted | Vue output is no longer generic Wesley surface area; reintroduce it only through an external target. |
| `packages/wesley-generator-js/`         | NR-080 | Deleted | Retained product TypeScript output lives in Rust emitters; Zod is only legacy CLI compatibility.     |
| `packages/wesley-scaffold-multitenant/` | NR-082 | Deleted | Product scaffolding belongs to product repositories, not generic Wesley.                             |
| `packages/wesley-test-fixtures/`        | NR-083 | Deleted | Useful fixtures live as plain `test/fixtures` files or Rust tests.                                   |
| `packages/wesley-tasks/`                | NR-084 | Deleted | Task graph truth remains descriptor-only in core until Rust planning proves a runtime need.          |
| `packages/wesley-core/`                 | NR-076 | Deleted | Rust core owns compiler authority.                                                                   |
| `packages/wesley-cli/`                  | NR-077 | Deleted | Rust CLI owns the product front door.                                                                |
| `packages/wesley-host-node/`            | NR-078 | Deleted | Node wrapper eliminated.                                                                             |
| `packages/wesley-runtime-node/`         | NR-079 | Deleted | Holmes owns retained support copies locally.                                                         |

## Execution Order

1. Keep shipping Rust-native compiler facts through `crates/wesley-core` and
   `crates/wesley-cli`.
2. Keep TypeScript in the Rust projection crate and move any future Zod work to
   an external target boundary.
3. Keep Holmes self-contained until its Rust redesign is ready.
4. Reintroduce browser/Bun/Deno behavior only through an explicit downstream
   owner or sibling repo.
5. Remove root `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` only
   after Holmes and JavaScript docs/test helpers are gone or externalized.

## Non-Goals

- Do not rebuild Node dynamic module loading in Rust just to preserve shape.
  The replacement is a Rust target registry plus an explicit WASM or
  external-process capability protocol.
- Do not move Echo footprint honesty into Wesley core.
- Do not move Postgres migrations into Wesley core.
- Do not keep browser/Bun/Deno hosts in this repo for the pure Rust milestone.
