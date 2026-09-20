# CLI reference

This page is the output of `wesley --help` and of each command group's
`--help`, captured from version 0.3.0-alpha.3. It is generated, not written:
if it disagrees with the binary, the binary is right. Regenerate it with
`node scripts/generate-cli-reference.mjs --wesley "$(cargo xtask built-cli)"`.

## wesley

```text
Wesley native CLI

Usage:
  wesley <command> [options]

Commands:
  normalize-sdl            Print the Rust-core normalized SDL view
  doctor                   Run Rust-native health checks
  init-law                 Scaffold weslaw/v1 from known SDL law directives
  config validate          Validate a Wesley project manifest
  config inspect           Print resolved manifest schema paths and targets
  config changed-schemas   Select schema sets affected by changed files
  target verify            Validate an external target descriptor
  schema lower              Lower GraphQL SDL to Wesley L1 IR JSON
  schema hash               Print the Wesley L1 registry hash for GraphQL SDL
  schema operations         List Query/Mutation/Subscription root operations
  schema diff               Compare GraphQL SDL states as Wesley L1 IR
  law validate              Validate weslaw against active GraphQL SDL
  law lint                  Validate weslaw structure without schema binding
  law diff                  Compare weslaw semantic Law IR states
  law explain               Explain active laws bound to one subject
  law rebind                Re-anchor weslaw to an active schema hash
  law capabilities          Emit report-only footprint capability summaries
  law coverage              Report profile/category-aware law coverage
  emit rust                 Emit Rust models and operation bindings from GraphQL SDL
  emit typescript           Emit TypeScript declarations and operation bindings from GraphQL SDL
  emit le-binary-typescript Emit TypeScript LE binary codecs from GraphQL SDL
  emit le-binary-rust       Emit Rust LE binary codecs from GraphQL SDL
  operation selections      Resolve selected operation fields
  operation directive-args  Extract operation directive arguments as JSON
  version                   Print the native CLI version

Options:
  -h, --help     Show help
  -V, --version  Show version
```

## normalize-sdl

```text
Wesley SDL normalizer

Usage:
  wesley normalize-sdl --schema <path> [--hash]

Options:
  -s, --schema <path>  GraphQL SDL file
  --hash               Print the SHA-256 of the normalized SDL
```

## doctor

```text
Wesley native doctor

Rust-native health checks only. This command does not inspect legacy Node,
pnpm, config modules, or plugin packages.

Usage:
  wesley doctor [--json]
  wesley doctor [--format text|json]

Options:
  --json                 Emit JSON output
  --format text|json     Output format
```

## init-law

```text
Wesley init-law

Scaffolds weslaw/v1 from formally known SDL law directives and draft
description-derived suggestions. Draft suggestions are not active law.

Usage:
  wesley init-law --schema <path> --family <name> [--out <path>]

Options:
  -s, --schema <path>  GraphQL SDL file
  --family <name>      Contract family id for the generated law document
  --out <path>         Optional output path; stdout when omitted
```

## config

```text
Wesley project manifest commands

Manifest files are domain-free JSON or YAML documents. The CLI discovers
wesley.config.json, wesley.config.yaml, or wesley.config.yml by walking upward
from the current directory when --config is omitted.

Usage:
  wesley config validate [--config <path>] [--json]
  wesley config inspect [--config <path>] [--json]
  wesley config changed-schemas [--config <path>] [--changed <path> ...] [--changed-file <path>] [--json]

Options:
  --config <path>        Manifest path; defaults to upward discovery
  --changed <path>       Changed file path; may be passed more than once
  --changed-file <path>  Newline-delimited changed file list
  --json                 Emit JSON output
```

## target

```text
Wesley target commands

External target commands validate descriptor metadata without assigning product
or runtime meaning to Wesley core.

Usage:
  wesley target verify <descriptor> [--json]

Options:
  --json  Emit JSON output
```

## schema

```text
Wesley schema commands

Usage:
  wesley schema lower --schema <path> [--json]
  wesley schema hash --schema <path> [--json]
  wesley schema operations --schema <path> [--json]
  wesley schema diff --old <path> --new <path> [--format text|json|summary] [--breaking-only] [--exit-code]
  wesley schema diff --schema <path> --against <rev> [--format text|json|summary] [--breaking-only] [--exit-code]

Options:
  -s, --schema <path>  GraphQL SDL file
  --old <path>         Old/base GraphQL SDL file
  --new <path>         New/target GraphQL SDL file
  --against <rev>      Git revision that provides the old schema state
  --base <rev>         Alias for --against
  --json               Emit JSON output
```

## law

```text
Wesley law commands

Usage:
  wesley law lint --law <path> [--json]
  wesley law validate --schema <path> --law <path> [--json]
  wesley law diff --old <path> --new <path> [--schema <path>] [--format markdown|json|summary]
  wesley law explain --law <path> <subject> [--json]
  wesley law rebind --schema <path> --law <path> [--accept --out <path>] [--json]
  wesley law capabilities --law <path> [--json]
  wesley law coverage --schema <path> --law <path> [--profile release|ci-release|local] [--json]

Options:
  -s, --schema <path>  GraphQL SDL file used to validate the new law document
  --law <path>         weslaw/v1 authoring file
  --old <path>         Old/base weslaw/v1 authoring file for diff
  --new <path>         New/target weslaw/v1 authoring file for diff
  --accept             Write an explicitly accepted rebind output
  --out <path>         Rebind output path
  --profile <name>     Coverage profile, default: release
  --json               Emit JSON output
  --format <format>    Output format: markdown, json, or summary
```

## emit

```text
Wesley emit commands

Emits model declarations and root operation bindings when the schema declares
Query, Mutation, or Subscription fields.

Usage:
  wesley emit rust --schema <path> --out <path> [--law <path>] [--metadata-out <path>]
  wesley emit typescript --schema <path> --out <path> [--law <path>] [--metadata-out <path>]
  wesley emit le-binary-typescript --schema <path> --out <path> [--law <path>] [--metadata-out <path>] [--codec-import <path>]
  wesley emit le-binary-rust --schema <path> --out <path> [--law <path>] [--metadata-out <path>] [--codec-import <path>]

Options:
  -s, --schema <path>    GraphQL SDL file
  --law <path>           Optional weslaw/v1 file for bundle hashes
  --out <path>           Output file
  --metadata-out <path>  Deterministic metadata JSON sidecar
  --codec-import <path>  Module specifier for Writer/Reader/CodecError (le-binary-* only)
```

## operation

```text
Wesley operation commands

Usage:
  wesley operation selections --operation <path> [--schema <path>] [--json]
  wesley operation directive-args --operation <path> --directive <name> [--json]

Options:
  -o, --operation <path>  GraphQL operation file
  -s, --schema <path>     Optional GraphQL schema SDL file
  -d, --directive <name>  Directive name, without or with @
```

## Exit status

Commands exit 0 on success and non-zero on failure. `wesley schema diff
--exit-code` exits 1 when the change is breaking.
