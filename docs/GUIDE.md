# Guide — Wesley

This is the developer-level operator guide for Wesley. Use it for orientation, the productive-fast path, and to understand how the contract compiler orchestrates shared truth.

For deep-track doctrine, IR model internals, and custom generator development, use [ADVANCED_GUIDE.md](./ADVANCED_GUIDE.md).

If you need the main Wesley nouns and the layer split before reading anything else, start with [WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md).

## Choose Your Lane

### 1. Core Compiler Lane

Compile authored GraphQL into generic or explicitly selected generated
artifacts.

- **Inspect native CLI**: `cargo wesley --help`
- **Doctor native CLI**: `cargo wesley doctor`
- **Install alpha from crates.io**: `cargo install wesley-cli --version 0.0.4`
- **Install locally**: `cargo install --locked --path crates/wesley-cli`
- **Rust preflight**: `cargo xtask preflight`
- **Release check**: `cargo xtask release-check`

The Rust-native CLI is now the normal front door for Wesley core work. The
native binary stays small while core behavior moves into the Rust library.
`wesley-core` exposes generic operation analysis primitives for resolving
selection paths and extracting directive arguments; Echo-owned tooling owns
Echo-specific footprint honesty checks.
Use `wesley normalize-sdl --schema <path>` when you need the consolidated,
sorted SDL view that the Rust compiler sees before emission or diffing. Add
`--hash` when you need stable evidence bytes for a normalized SDL snapshot.
Use `wesley doctor` when you need a narrow Rust-native health check for the
native CLI, Rust lowerer, normalized SDL hashing, and Rust emitter crates. It
does not inspect legacy Node config, plugins, or package state.

Use `cargo install wesley-cli --version 0.0.4` when you want the published
alpha `wesley` binary on your PATH. Use
`cargo install --locked --path crates/wesley-cli` when working from this
checkout. Use `cargo xtask release-check` before cutting native release
artifacts; it runs the Rust tests, builds the optimized binary, and packages
the Rust library crate without publishing anything.

The historical package CLI is retired. Use the native commands:

- **Lower**: `wesley schema lower --schema <path> --json`
- **Hash**: `wesley schema hash --schema <path>`
- **Diff**: `wesley schema diff --old <old> --new <new> --format summary`
- **Law**: `wesley law validate --schema <schema> --law <law> [--json]`
- **Law Diff**: `wesley law diff --old <old-law> --new <new-law> --json`

- **Rust**: `wesley emit rust --schema <path> --out <path> [--law <path>]`
- **TypeScript**: `wesley emit typescript --schema <path> --out <path> [--law <path>]`
- **Emit metadata**: add `--metadata-out <path>` to record schema hash,
  generator identity, generator version, and `rust-native` execution mode. When
  `--law <path>` is supplied, metadata also records `schemaHashQualified`,
  `lawHash`, `lawDocumentHash`, `profileHash`, `bundleHash`, and the Law IR
  codec.

For legacy migration users still calling `pnpm wesley`, rewrite the caller.
The direct replacements are `wesley schema lower`, `wesley schema hash`,
`wesley schema diff`, `wesley law validate`, `wesley law diff`,
`wesley doctor`, and `wesley emit typescript` or `wesley emit rust`.
Zod and certificate commands are no longer generic compiler-front-door work.
Holmes-family commands live under `@wesley/holmes`.

Zod output is no longer treated as core Wesley retirement work. Reintroduce it
through an external target module or package when a consumer needs JavaScript
validation output.

### 2. External Module Lane

Bring the `whatever` side of `GraphQL -> whatever` through explicit modules.

- **Config**: add modules in `wesley.config.mjs`
- **Environment**: set `WESLEY_MODULES=/path/to/module.mjs`
- **Commands**: module-owned commands appear through the loaded module
- **Disable**: set `WESLEY_DISABLE_MODULES=1` for a no-module diagnostic run
- **Trust**: set `WESLEY_MODULE_ALLOWLIST` to path-delimited config/module
  paths when CI should reject unapproved module imports

External modules own target semantics, generators, witness scopes, release
profiles, and runtime conventions. Wesley core does not own those meanings.
For the active ownership rule, see
[design/0014-domain-empty-core-boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md).

Historical Continuum, WARPspace, PostgreSQL, and Supabase package residue has
been removed from the compiler front door. New domain behavior should land in
the owning external module repo, not in Wesley.

### 3. Governance & Inspection

Audit proposed changes, emit HOLMES reports, and inspect the static dashboard
artifact assembled by CI.
These are assurance/tooling surfaces outside compiler authority.

- **HOLMES report**: `pnpm --filter @wesley/holmes exec node src/cli.mjs report --help`
- **Dashboard artifact**: open `docs/holmes-dashboard/index.html` with the
  HOLMES workflow JSON artifacts. See
  [architecture/holmes-integration.md](./architecture/holmes-integration.md#report-validation--dashboard).

## Compiler Versus Toolchain

Wesley is easiest to understand if you keep two layers separate.

### Wesley core

The core compiler behaves like a compiler:

- authored GraphQL in
- targets selected explicitly
- outputs written where the caller asks

That is the center of the system.

### Wesley toolchain

This repo also ships surrounding toolchain surfaces:

- realization manifests
- witness/conformance commands
- release/bundle assembly
- sync/projection helpers
- HOLMES / Watson / Moriarty / BLADE

Those surfaces operate on compiler inputs and outputs. They are useful, but
they are not the same thing as the core compile act.

For the exact boundary, see
[architecture/wesley-core-vs-toolchain.md](./architecture/wesley-core-vs-toolchain.md).

For practical extension rules, see [guides/extending.md](./guides/extending.md).

For the noun-by-noun version of that split, see
[WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md).

## Big Picture: System Orchestration

Wesley is a tiered engine designed to enforce contract integrity across platforms:

1. **Compiler API (Surfaces)**: The CLI and internal SDK are thin interfaces that communicate with the core. They ensure that all transformations are explicit and logged.
2. **Compiler Core (The Engine)**: Manages the GraphQL parser, the platform-neutral IR, and the transmutation pipeline. It ensures that "Trustworthy Change" is a technical guarantee.
3. **Realization Shells (Packaging)**: Each emitted leg carries a manifest and signatures that let Wesley verify source identity and artifact integrity without treating generated files as authorities.
4. **Witness Surfaces (Proof)**: Witness commands certify bounded properties against authored source, emitted artifacts, and realization shells. They do not stand in for runtime observation unless a scope explicitly proves that too.

## Orientation Checklist

- [ ] **I am setting up Rust core work**: Run `cargo xtask preflight`.
- [ ] **I am changing docs only**: Run `cargo xtask docs-check`.
- [ ] **I am changing retained JS packages or pnpm workspace files**: Run `pnpm install` and `cargo xtask legacy-preflight`.
- [ ] **I am modifying a schema**: Always start in the `.graphql` file.
- [ ] **I am adding a generic projection**: Start in `crates/wesley-emit-rust` or `crates/wesley-emit-typescript`.
- [ ] **I am adding a domain target**: Put it in an external module repo and load it into Wesley.
- [ ] **I am extending Wesley**: Use `docs/guides/extending.md` to pick the Rust core, native CLI, emitter, external module, or `xtask` boundary.
- [ ] **I am contributing to Wesley**: Read `METHOD.md` and `BEARING.md`.
- [ ] **I am touching Continuum behavior**: Work in the Continuum-owned module/repo, not here.
- [ ] **I am touching PostgreSQL or Supabase behavior**: Work in `wesley-postgres`, not here.

## Rule of Thumb

If you need the native command reference, use `cargo wesley --help`.

If you need to know "what's true right now," use [BEARING.md](./BEARING.md).

If you need the exact boundary between authored source, realization shells, and
bounded witness claims, use [design/0004-realization-admission-and-witness/realization-admission-and-witness.md](./design/0004-realization-admission-and-witness/realization-admission-and-witness.md).

If you need the clean split between Wesley base platform, extension modules,
and project workspaces, use
[WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md) and
[design/wesley-pipeline.md](./design/wesley-pipeline.md).

If you are just starting, use the [README.md](../README.md) and the orientation tracks above.

---

**The goal is inevitably. Every state transition is a provable consequence of the sovereign schema.**
