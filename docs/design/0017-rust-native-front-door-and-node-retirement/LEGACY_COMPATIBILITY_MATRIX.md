# Legacy Compatibility Matrix

This matrix names every remaining package under `packages/` and the gate that
lets Wesley delete, externalize, or rebuild it without silently restoring Node
as product authority.

| Package                         | Current lane                                  | Retirement gate                                                                                                                |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/wesley-core/`         | Legacy JS compiler and package tests          | Rust core owns every retained compiler fact; remaining domain/product behavior is rejected or moved to an owning module.       |
| `packages/wesley-cli/`          | Legacy command framework                      | Useful commands are ported, extracted, or explicitly retired; public docs no longer present `pnpm wesley` as the product path. |
| `packages/wesley-host-node/`    | Legacy Node executable wrapper                | Native Rust CLI covers product work; package tests are either native, compatibility-only, or deleted.                          |
| `packages/wesley-runtime-node/` | Legacy Node module loading and host utilities | Rust capability registry or external-process protocol covers retained module execution needs.                                  |
| `packages/wesley-generator-js/` | Legacy JS, TypeScript, and Zod emitters       | Native Rust emitters cover retained generic TypeScript; Zod and JavaScript-specific output move to an external target owner.   |
| `packages/wesley-holmes/`       | Legacy assurance and evidence tooling         | Assurance has an explicit package or repo boundary separate from compiler authority.                                           |
| `packages/wesley-host-browser/` | Legacy browser host experiment                | Browser compatibility is externalized or no longer needed as evidence.                                                         |
| `packages/wesley-host-bun/`     | Legacy Bun host experiment                    | Bun compatibility is externalized or no longer needed as evidence.                                                             |
| `packages/wesley-host-deno/`    | Legacy Deno host experiment                   | Deno compatibility is externalized or no longer needed as evidence.                                                            |

All rows above must stay private npm workspace packages while they remain in
the Node retirement ledger. The machine-readable warning lives in each
`package.json` under `wesley.retirement`, and `cargo xtask docs-check` fails if
that warning disappears.

## Current Deletion Blockers

| Slice  | Package                         | Blocking evidence                                                                      |
| ------ | ------------------------------- | -------------------------------------------------------------------------------------- |
| NR-076 | `packages/wesley-core/`         | Still imported by Holmes, host compatibility packages, JS generator, and scripts.      |
| NR-077 | `packages/wesley-cli/`          | Still owns legacy assurance/runtime commands and Bats compatibility suites.            |
| NR-078 | `packages/wesley-host-node/`    | Still referenced by compatibility workflows, root scripts, and legacy CLI smoke tests. |
| NR-079 | `packages/wesley-runtime-node/` | Still used by Holmes/runtime evidence and parser/parity migration scripts.             |
| NR-080 | `packages/wesley-generator-js/` | Still used by the legacy CLI for Zod/models/TypeScript compatibility commands.         |

## Retired

| Package                                 | Slice  | Outcome | Notes                                                                                             |
| --------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------- |
| `packages/wesley-generator-vue/`        | NR-081 | Deleted | The Vue projection experiment has no generic Wesley owner; future Vue output belongs in a module. |
| `packages/wesley-scaffold-multitenant/` | NR-082 | Deleted | Product scaffold residue has no generic Wesley owner; future scaffolds belong to product repos.   |
| `packages/wesley-test-fixtures/`        | NR-083 | Deleted | Shared fixture helpers were replaced by plain `test/fixtures` and Rust test assets.               |
| `packages/wesley-tasks/`                | NR-084 | Deleted | Task graph truth is descriptor-only in Rust/JS core until a generic runtime need is proved.       |
