# Native CLI

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when you need to run Wesley or decide which command surface is
current.

Wesley's product front door is the Rust-native `wesley` binary. The historical
Node wrapper is retired.

## Common Tasks

Inspect the local checkout binary:

```bash
cargo run --bin wesley -- --help
```

Run a narrow Rust-native health check:

```bash
cargo run --bin wesley -- doctor --json
```

Install the published CLI package after a release:

```bash
cargo install wesley-cli --version X.Y.Z
wesley --help
```

Use the installed binary in scripts only when the version is pinned by the
script or release environment. Use `cargo run --bin wesley -- ...` when
validating this checkout before a PR or release.

## Current Command Families

| Family      | Use For                                                        |
| ----------- | -------------------------------------------------------------- |
| `schema`    | Lowering, hashing, operation catalogs, and schema diffs.       |
| `operation` | Resolving operation selections and directive arguments.        |
| `emit`      | Rust, TypeScript, and LE-binary codec projections.             |
| `config`    | Project manifest validation, inspection, and changed schemas.  |
| `target`    | Verify external target descriptors without executing target code. |
| `normalize-sdl` | Emit canonical normalized GraphQL SDL.                     |
| `doctor`    | Rust-native health checks for the compiler spine.              |

The command help text and [CLI Reference](../reference/cli.md) are the command
surface authority.

## Retired Command Surface

Do not add new docs that present `pnpm wesley` as the product entry point.
Retained JavaScript is for assurance tooling, docs tooling, package tests, and
workspace maintenance outside compiler authority.

## Related Authority

- [CLI Reference](../reference/cli.md)
- [ENTRYPOINTS](../ENTRYPOINTS.md)
- [Legacy Node Migration](../LEGACY_NODE_MIGRATION.md)
- [Validation](./validation.md)
