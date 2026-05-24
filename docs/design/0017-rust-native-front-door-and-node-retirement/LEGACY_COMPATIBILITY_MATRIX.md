# Legacy Compatibility Matrix

This matrix names every remaining package under `packages/` and the gate that
lets Wesley delete, externalize, or rebuild it without silently restoring Node
as product authority.

| Package                                 | Current lane                                  | Retirement gate                                                                                                                |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/wesley-core/`                 | Legacy JS compiler and package tests          | Rust core owns every retained compiler fact; remaining domain/product behavior is rejected or moved to an owning module.       |
| `packages/wesley-cli/`                  | Legacy command framework                      | Useful commands are ported, extracted, or explicitly retired; public docs no longer present `pnpm wesley` as the product path. |
| `packages/wesley-host-node/`            | Legacy Node executable wrapper                | Native Rust CLI covers product work; package tests are either native, compatibility-only, or deleted.                          |
| `packages/wesley-runtime-node/`         | Legacy Node module loading and host utilities | Rust capability registry or external-process protocol covers retained module execution needs.                                  |
| `packages/wesley-generator-js/`         | Legacy JS, TypeScript, and Zod emitters       | Native Rust emitters cover retained generic TypeScript; Zod and JavaScript-specific output move to an external target owner.   |
| `packages/wesley-generator-vue/`        | Legacy Vue projection experiment              | A target owner accepts it outside generic Wesley, or the package is deleted.                                                   |
| `packages/wesley-holmes/`               | Legacy assurance and evidence tooling         | Assurance has an explicit package or repo boundary separate from compiler authority.                                           |
| `packages/wesley-host-browser/`         | Legacy browser host experiment                | Browser compatibility is externalized or no longer needed as evidence.                                                         |
| `packages/wesley-host-bun/`             | Legacy Bun host experiment                    | Bun compatibility is externalized or no longer needed as evidence.                                                             |
| `packages/wesley-host-deno/`            | Legacy Deno host experiment                   | Deno compatibility is externalized or no longer needed as evidence.                                                            |
| `packages/wesley-scaffold-multitenant/` | Product scaffold residue                      | The scaffold moves to a product owner or is deleted.                                                                           |
| `packages/wesley-tasks/`                | Legacy task planning utilities                | Rust execution planning proves a generic need, or the package is deleted.                                                      |
| `packages/wesley-test-fixtures/`        | Legacy package fixture helpers                | Useful fixtures move into plain `test/fixtures` or Rust tests.                                                                 |

All rows above must stay private npm workspace packages while they remain in
the Node retirement ledger. The machine-readable warning lives in each
`package.json` under `wesley.retirement`, and `cargo xtask docs-check` fails if
that warning disappears.
