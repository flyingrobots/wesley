# Guide — Wesley

This is the developer-level operator guide for Wesley. Use it for orientation, the productive-fast path, and to understand how the contract compiler orchestrates shared truth.

For deep-track doctrine, IR model internals, and custom generator development, use [ADVANCED_GUIDE.md](./ADVANCED_GUIDE.md).

If you need the main Wesley nouns and the layer split before reading anything else, start with [WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md).

## Choose Your Lane

### 1. Core Compiler Lane
Compile authored GraphQL into generic or explicitly selected generated
artifacts.
- **Inspect**: `pnpm wesley --help`
- **TypeScript**: `pnpm wesley typescript --schema <path>`
- **Zod**: `pnpm wesley zod --schema <path>`
- **Transform**: `pnpm wesley transform --schema <path> --transmutation <target>`

These command paths reuse a hash-addressed IR cache in `.wesley-cache/ir/` when the authored SDL has not changed, which keeps the inner loop tighter across repeated local runs.

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

The current repository still contains historical Continuum, WARPspace,
PostgreSQL, and Supabase command/package residue. Treat those paths as
extraction debt. New domain behavior should land in the owning external module
repo, not in Wesley.

### 3. Governance & Inspection
Audit proposed changes, emit HOLMES reports, and inspect the static dashboard
artifact assembled by CI.
- **Certificate**: `pnpm wesley cert-create --help`
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

For the noun-by-noun version of that split, see
[WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md).

## Big Picture: System Orchestration

Wesley is a tiered engine designed to enforce contract integrity across platforms:

1. **Compiler API (Surfaces)**: The CLI and internal SDK are thin interfaces that communicate with the core. They ensure that all transformations are explicit and logged.
2. **Compiler Core (The Engine)**: Manages the GraphQL parser, the platform-neutral IR, and the transmutation pipeline. It ensures that "Trustworthy Change" is a technical guarantee.
3. **Realization Shells (Packaging)**: Each emitted leg carries a manifest and signatures that let Wesley verify source identity and artifact integrity without treating generated files as authorities.
4. **Witness Surfaces (Proof)**: Witness commands certify bounded properties against authored source, emitted artifacts, and realization shells. They do not stand in for runtime observation unless a scope explicitly proves that too.

## Orientation Checklist

- [ ] **I am setting up the repo**: Run `pnpm install` and `pnpm run preflight`.
- [ ] **I am modifying a schema**: Always start in the `.graphql` file.
- [ ] **I am adding a new generic generator**: Check `packages/wesley-generator-js` for a baseline.
- [ ] **I am adding a domain target**: Put it in an external module repo and load it into Wesley.
- [ ] **I am contributing to Wesley**: Read `METHOD.md` and `BEARING.md`.
- [ ] **I am touching Continuum behavior**: Work in the Continuum-owned module/repo, not here.
- [ ] **I am touching PostgreSQL or Supabase behavior**: Work in `wesley-postgres`, not here.

## Rule of Thumb

If you need a comprehensive command reference, use `pnpm wesley --help`.

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
