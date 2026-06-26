# Legacy Compatibility Matrix

The legacy Node compatibility matrix is closed. It now records the final package
state after the 96-slice campaign.

## Retained Non-Compiler Packages

| Package                   | Current lane                     | Boundary                                                                   |
| ------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `packages/wesley-holmes/` | Self-contained assurance tooling | May inspect evidence and publish reports; must not own compiler authority. |

All retained rows remain private workspace packages and carry
`wesley.retirement` metadata so the retirement ledger guard continues to know
why they are not compiler authority.

## Deleted Compatibility Packages

| Package                                 | Slice  | Outcome | Notes                                                                             |
| --------------------------------------- | ------ | ------- | --------------------------------------------------------------------------------- |
| `packages/wesley-core/`                 | NR-076 | Deleted | Rust crates own retained compiler authority.                                      |
| `packages/wesley-cli/`                  | NR-077 | Deleted | The Rust CLI owns the product front door.                                         |
| `packages/wesley-host-node/`            | NR-078 | Deleted | No retained test, script, or workflow shells through the Node executable wrapper. |
| `packages/wesley-runtime-node/`         | NR-079 | Deleted | Holmes-local support owns retained ledger and module capability helpers.          |
| `packages/wesley-generator-js/`         | NR-080 | Deleted | Retained generic TypeScript output belongs to Rust emitters.                      |
| `packages/wesley-generator-vue/`        | NR-081 | Deleted | Vue output has no generic Wesley owner.                                           |
| `packages/wesley-scaffold-multitenant/` | NR-082 | Deleted | Product scaffolding belongs to product repos.                                     |
| `packages/wesley-test-fixtures/`        | NR-083 | Deleted | Shared fixtures are plain `test/fixtures` and Rust test assets.                   |
| `packages/wesley-tasks/`                | NR-084 | Deleted | Task execution policy does not live in a generic JavaScript package.              |
| `packages/wesley-host-browser/`         | GH-629 | Deleted | Browser execution is not a supported Wesley release surface.                      |
| `packages/wesley-host-bun/`             | GH-629 | Deleted | Bun execution is not a supported Wesley release surface.                          |
| `packages/wesley-host-deno/`            | GH-629 | Deleted | Deno execution is not a supported Wesley release surface.                         |

## Current Deletion Blockers

None. New blockers should be logged as ordinary backlog items, not as open
legacy Node retirement slices.
