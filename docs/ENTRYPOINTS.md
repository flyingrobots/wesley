# ENTRYPOINTS
<!-- docs-truth: status=experimental owner=@flyingrobots -->

Wesley has one intended front door:

```bash
cargo wesley --help
```

The native command is now the first user-facing Rust surface for compiler facts.
The deeper source of truth is still the Rust library under `crates/wesley-core`.
New compiler behavior should start there, then grow a native CLI command when it
needs one.

The Node packages still exist, but they are not a second Wesley. They are the
historical package toolchain: old CLI commands, generators, host adapters,
module loading, and evidence tooling that have not yet been extracted, retired,
or ported. Their migration map lives in
[LEGACY_NODE_MIGRATION.md](./LEGACY_NODE_MIGRATION.md).

## What Lives Where

| Surface | Path | Status | What it does |
| --- | --- | --- | --- |
| Rust compiler kernel | `crates/wesley-core/` | Canonical for new compiler work | Lowers GraphQL SDL into domain-empty L1 IR; diffs L1 schema structure; resolves operation selections; extracts directive arguments. |
| Native Wesley command | `crates/wesley-cli/` | Rust product CLI | Provides schema lowering, schema hashing, schema diffing, operation selection analysis, and directive argument extraction from the Rust core. |
| Repo automation | `xtask/` | Current Rust maintenance front door | Runs docs checks, Rust tests, native preflight, release checks, and the legacy preflight bridge. |
| Legacy JS core | `packages/wesley-core/` | Legacy/tooling | Historical JavaScript compiler domain, module registry, hashes, generation pipeline, and runtime helpers. |
| Legacy JS CLI | `packages/wesley-cli/` | Legacy/tooling | Historical command framework for generate/transform/typescript/zod/diff/cert/Holmes-era flows. |
| Legacy Node host | `packages/wesley-host-node/` | Legacy/tooling | Node executable wrapper and runtime adapter around the JS CLI. |
| Legacy generators | `packages/wesley-generator-*` | Legacy/tooling | Existing TypeScript/Zod/Vue projection surfaces. Useful until ported or externalized. |
| Legacy evidence tooling | `packages/wesley-holmes/` | Legacy/tooling | Holmes/Moriarty-era evidence, verification, and counterfactual tooling. |
| Root Node workspace | `package.json`, `pnpm-workspace.yaml` | Workspace plumbing | Keeps old packages, docs checks, package tests, and website tooling installable. It is not the Wesley product entry point. |

## What Rust Wesley Does Today

Rust Wesley is the emerging compiler kernel.

It can:

- parse and lower GraphQL SDL into the L1 semantic IR
- consolidate `extend type` blocks before lowering
- compute stable canonical JSON and hashes for L1 IR
- compute structural L1 schema deltas
- resolve GraphQL operation selection paths
- resolve schema-coordinate selections when schema SDL is available
- extract arbitrary operation directive arguments as data

The native CLI exposes those facts through:

```bash
wesley schema lower --schema <path> --json
wesley schema hash --schema <path>
wesley schema diff --old <path> --new <path> [--format text|json|summary] [--exit-code]
wesley operation selections --operation <path> [--schema <path>] [--json]
wesley operation directive-args --operation <path> --directive <name> --json
```

## What Node Wesley Does Today

Node Wesley is the historical toolchain.

It can still run older package workflows such as:

- package preflight and package tests
- TypeScript/Zod generation
- module-loaded compile/transform flows
- Node host execution
- Holmes/Moriarty evidence tooling
- website and docs-support tooling

Those surfaces are useful, but they are not the architectural center. When a
Node surface is still needed, either keep it clearly marked as legacy tooling or
move the capability to the owning module/repo. Do not add new core compiler
truth to the Node side.

## How To Choose

| If you are doing this | Use this |
| --- | --- |
| Adding or changing compiler semantics | `crates/wesley-core/` |
| Adding a user-facing Wesley command | `crates/wesley-cli/` |
| Running Rust health checks | `cargo xtask preflight` |
| Checking docs links/truth/local-path hygiene | `cargo xtask docs-check` |
| Preparing native release artifacts | `cargo xtask release-check` |
| Touching old JS packages, docs drift checks, or package tests | `cargo xtask legacy-preflight` |
| Using an old generator that only exists in JS | `pnpm wesley ...` for now, then plan a port or extraction |
| Implementing Echo footprint honesty | Echo-owned tooling, not generic Wesley |
| Implementing Postgres migrations or SQL projection | `wesley-postgres` or another external target module, not `wesley-core` |

## Migration Rule

There should be one brain and one body:

- **Brain**: `crates/wesley-core`
- **Body**: `crates/wesley-cli`
- **Legacy support surfaces**: `packages/`, kept only while they still carry
  unported generator, host, evidence, or package-maintenance value

Until this migration is complete, any document or workflow that presents
`pnpm wesley` as Wesley's main command surface is stale by default.
