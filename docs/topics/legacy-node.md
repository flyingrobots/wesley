# Legacy Node Retirement

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when an old command, package, workflow, or doc still points at
Node-era Wesley.

The historical Node CLI and host packages are retired as Wesley product
surfaces. JavaScript remains only for retained package tooling, assurance
tooling, docs tooling, and repository maintenance.

## Replacement Rules

| Old Surface                         | Current Direction                         |
| ----------------------------------- | ----------------------------------------- |
| `pnpm wesley` product CLI           | Native `wesley` binary from `wesley-cli`. |
| Node compiler packages              | Rust crates under `crates/`.              |
| Browser/Bun/Deno host packages      | Retired from generic Wesley.              |
| Vue, Zod, product generators        | External target modules when needed.      |
| Certificate/runtime ledger commands | Assurance-owned package or future design. |

## Common Rewrites

| Legacy Call                              | Current Path                                          |
| ---------------------------------------- | ----------------------------------------------------- |
| `pnpm wesley doctor`                     | `wesley doctor`                                       |
| `pnpm wesley diff <old> <new>`           | `wesley schema diff --old <old> --new <new>`          |
| `pnpm wesley typescript --schema <path>` | `wesley emit typescript --schema <path> --out <path>` |
| `pnpm wesley generate --schema <path>`   | Native emitters or an external target module.         |

## Rules Of Thumb

- If a doc presents Node as Wesley's product front door, it is stale by
  default.
- Reintroduce retired host behavior only through a downstream owner or explicit
  target protocol.
- Do not preserve Node shapes just because they existed historically.

## Related Authority

- [Legacy Node Migration](../LEGACY_NODE_MIGRATION.md)
- [ENTRYPOINTS](../ENTRYPOINTS.md)
- [Native CLI](./native-cli.md)
- [Compiler Boundary](./compiler-boundary.md)
