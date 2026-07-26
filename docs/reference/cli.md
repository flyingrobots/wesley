# Wesley CLI Reference

<!-- docs-truth: status=current owner=@flyingrobots -->

This reference describes the Rust-native `wesley` command shipped by the
`wesley-cli` crate.

The command help text is the implementation source of truth. Refresh this page
from `cargo run --bin wesley -- --help` and the nested `--help` commands whenever the CLI
surface changes.

## Root Command

```text
wesley <command> [options]
```

Options:

| Option            | Meaning      |
| ----------------- | ------------ |
| `-h`, `--help`    | Show help    |
| `-V`, `--version` | Show version |

Commands:

| Command                     | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `normalize-sdl`             | Print the Rust-core normalized SDL view                      |
| `doctor`                    | Run Rust-native health checks                                |
| `config validate`           | Validate a Wesley project manifest                           |
| `config inspect`            | Print resolved manifest schema paths and targets             |
| `config changed-schemas`    | Select schema sets affected by changed files                 |
| `target verify`             | Validate an external target descriptor without execution     |
| `schema lower`              | Lower GraphQL SDL to Wesley L1 IR JSON                       |
| `schema hash`               | Print the Wesley L1 registry hash for GraphQL SDL            |
| `schema operations`         | List Query/Mutation/Subscription root operations             |
| `schema diff`               | Compare GraphQL SDL states as Wesley L1 IR                   |
| `emit rust`                 | Emit Rust models and operation bindings from GraphQL SDL     |
| `emit typescript`           | Emit TypeScript declarations and operation bindings from SDL |
| `emit le-binary-typescript` | Emit TypeScript LE-binary codecs from GraphQL SDL            |
| `emit le-binary-rust`       | Emit Rust LE-binary codecs from GraphQL SDL                  |
| `operation selections`      | Resolve selected operation fields                            |
| `operation directive-args`  | Extract operation directive arguments as JSON                |
| `version`                   | Print the native CLI version                                 |

## Normalized SDL

```text
wesley normalize-sdl --schema <path> [--hash]
```

Options:

| Option                  | Meaning                             |
| ----------------------- | ----------------------------------- |
| `-s`, `--schema <path>` | GraphQL SDL file                    |
| `--hash`                | Print the SHA-256 of normalized SDL |

## Doctor

```text
wesley doctor [--json]
wesley doctor [--format text|json]
```

`doctor` runs Rust-native health checks only. It does not inspect legacy Node,
pnpm, config modules, or plugin packages.

Options:

| Option                | Meaning          |
| --------------------- | ---------------- |
| `--json`              | Emit JSON output |
| `--format text\|json` | Output format    |

## Config

```text
wesley config validate [--config <path>] [--json]
wesley config inspect [--config <path>] [--json]
wesley config changed-schemas [--config <path>] [--changed <path> ...] [--changed-file <path>] [--json]
```

`config` commands operate on the domain-free Wesley project manifest. When
`--config` is omitted, the CLI walks upward from the current directory looking
for `wesley.config.json`, `wesley.config.yaml`, `wesley.config.yml`, or
`.wesley/config.json`.

Options:

| Option                  | Meaning                                         |
| ----------------------- | ----------------------------------------------- |
| `--config <path>`       | Manifest path; defaults to upward discovery     |
| `--changed <path>`      | Changed file path; may be passed more than once |
| `--changed-file <path>` | Newline-delimited changed file list             |
| `--json`                | Emit JSON output                                |

The project manifest is documented in
[Project Manifest](./project-manifest.md).

## Target

```text
wesley target verify <descriptor> [--json]
```

`target verify` validates a `wesley.target-descriptor/v1` descriptor without
executing the descriptor command. It checks the protocol version, path-safe
target name, descriptor-relative command path, bounded timeout, required input
and output capabilities, denied network and ambient filesystem requests, and
workspace-relative output directory.

Options:

| Option   | Meaning          |
| -------- | ---------------- |
| `--json` | Emit JSON output |

`target verify` is descriptor validation only. Wesley still does not ship
`target run`, process sandboxing, artifact copy-out, or target SDK execution.

## Schema

```text
wesley schema lower --schema <path> [--json]
wesley schema hash --schema <path> [--json]
wesley schema operations --schema <path> [--json]
wesley schema diff --old <path> --new <path> [--format text|json|summary] [--breaking-only] [--exit-code]
wesley schema diff --schema <path> --against <rev> [--format text|json|summary] [--breaking-only] [--exit-code]
```

Options:

| Option                  | Meaning                                     |
| ----------------------- | ------------------------------------------- |
| `-s`, `--schema <path>` | GraphQL SDL file                            |
| `--old <path>`          | Old/base GraphQL SDL file                   |
| `--new <path>`          | New/target GraphQL SDL file                 |
| `--against <rev>`       | Git revision that provides old schema state |
| `--base <rev>`          | Alias for `--against`                       |
| `--json`                | Emit JSON output                            |

`schema lower`, `schema hash`, and `schema operations` may omit `--schema` only
when the discovered project manifest contains exactly one schema path.

## Emit

```text
wesley emit rust --schema <path> --out <path> [--metadata-out <path>]
wesley emit typescript --schema <path> --out <path> [--metadata-out <path>]
wesley emit le-binary-typescript --schema <path> --out <path> [--metadata-out <path>] [--codec-import <path>]
wesley emit le-binary-rust --schema <path> --out <path> [--metadata-out <path>] [--codec-import <path>]
```

Emit commands write model declarations and root operation bindings when the
schema declares Query, Mutation, or Subscription fields.

Options:

| Option                  | Meaning                                                 |
| ----------------------- | ------------------------------------------------------- |
| `-s`, `--schema <path>` | GraphQL SDL file                                        |
| `--out <path>`          | Output file                                             |
| `--metadata-out <path>` | Deterministic metadata JSON sidecar                     |
| `--codec-import <path>` | Writer/Reader/CodecError module specifier for LE-binary |

## Operation

```text
wesley operation selections --operation <path> [--schema <path>] [--json]
wesley operation directive-args --operation <path> --directive <name> [--json]
```

Options:

| Option                     | Meaning                             |
| -------------------------- | ----------------------------------- |
| `-o`, `--operation <path>` | GraphQL operation file              |
| `-s`, `--schema <path>`    | Optional GraphQL schema SDL file    |
| `-d`, `--directive <name>` | Directive name, without or with `@` |

## Version

```text
wesley version
```
