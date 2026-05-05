# Wesley
<!-- docs-truth: status=experimental owner=@flyingrobots -->

A schema-first compiler kernel for trustworthy change. Wesley turns authored
GraphQL into derived artifacts through explicit target modules, while keeping
source identity, lowering, artifact emission, and evidence separate.

Wesley itself is the core `GraphQL -> whatever` compiler and assurance
toolchain. The `whatever` is brought by modules outside the core repo. Domain
systems such as Continuum and PostgreSQL are not Wesley product surfaces; their
generators, policies, witnesses, and runtime conventions belong in external
module repos such as Continuum itself or `wesley-postgres`.

[![Overall](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/flyingrobots/wesley/main/meta/badges/overall.json)](README.md)
[![License](https://img.shields.io/github/license/wesley)](./LICENSE)

## Why Wesley?

Unlike traditional code-generators that treat schemas as suggestions, Wesley treats the schema as the sovereign system of record.

- **Contract Sovereignty**: Authored GraphQL SDL is the single source of truth. Generated artifacts are derived surfaces that are never allowed to become peer authorities.
- **Admission Discipline**: Authored source, lowered IR, realization shells, and witness output are kept distinct so Wesley can certify explicit properties without overstating runtime truth.
- **Module-Brought Targets**: Wesley owns parsing, lowering, dispatch, artifact bookkeeping, and assurance plumbing. Modules own target semantics, generators, policy, witness scopes, and release conventions.
- **Evidence-Backed Change**: Toolchain surfaces can produce machine-readable evidence that a proposed artifact bundle is coherent with the authored source and selected modules.
- **Cross-Language Inevitability**: By generating bit-exact codecs and IR envelopes, Wesley prevents the "adapter spaghetti" that typically causes multi-repo platforms to rot.
- **Local-First Operation**: The compiler and witness suite run entirely on the local developer workstation, ensuring that contract verification is part of the fast inner-loop.

## Quick Start

### 1. Repository Preflight
Install dependencies and verify the local compiler health.
```bash
pnpm install
pnpm run preflight
```

### 2. Compile A Generic Projection
Generate TypeScript from an authored GraphQL schema.
```bash
pnpm wesley typescript \
  --schema ./schema.graphql \
  --out-file ./generated/types.generated.ts
```

### 3. Load A Target Module
Select target behavior explicitly from project config or `WESLEY_MODULES`.
```bash
WESLEY_MODULES=/path/to/my-wesley-module.mjs pnpm wesley --help
```
Modules are trusted Node code. Use `WESLEY_DISABLE_MODULES=1` for a no-module
diagnostic run, or set `WESLEY_MODULE_ALLOWLIST` to path-delimited config/module
paths in CI environments that must refuse unapproved module imports.

The current repo still carries historical Continuum and PostgreSQL surfaces.
They are extraction debt, not Wesley identity. New target semantics should land
in external modules rather than in this repository.

## Overall Status

<!-- BEGIN:OVERALL_STATUS -->
Stage: MVP  \
Progress: 61% → Alpha
<!-- END:OVERALL_STATUS -->

## Package Matrix

<!-- BEGIN:PACKAGE_MATRIX -->
| Package | Status | Stage | Progress | CI | Notes |
| --- | --- | --- | --- | --- | --- |
| `@wesley/core` | Active | MVP | 45% → Alpha | — | Pure domain logic, no Node builtins |
| `@wesley/cli` | Active | Alpha | 50% → Beta | — | CLI + Bats suites |
| `@wesley/host-node` | Active | MVP | 50% → Alpha | — | Node adapters + binary |
| `@wesley/host-browser` | Experimental | MVP | 40% → Alpha | — | Pure ESM; in-memory FS; minimal parser; smoke-level only |
| `@wesley/generator-js` | Active | MVP | 50% → Alpha | — | TS/Zod emitters |
| `@wesley/generator-vue` | Experimental | MVP | 0% → Alpha | — | Vue-facing TS/composable emitters |
| `@wesley/holmes` | Active | Alpha | 50% → Beta | — | Evidence scoring |
| `@wesley/runtime-node` | Active | MVP | 0% → Alpha | — | Shared Node runtime adapters |
| `@wesley/tasks` | Active | MVP | 50% → Alpha | — | Planner utilities |
| `@wesley/host-deno` | Experimental | Alpha | 50% → Beta | — | Deno host runtime (demo) |
| `@wesley/host-bun` | Experimental | Alpha | 50% → Beta | — | Bun host runtime (demo) |
| `@wesley/scaffold-multitenant` | Too soon | Prototype | 50% → MVP | — | Early scaffold, no CI yet |
| `@wesley/test-fixtures` | Active | MVP | 20% → Alpha | — | Private shared fixtures + schema builders |
<!-- END:PACKAGE_MATRIX -->

## Documentation

- **[Guide](./docs/GUIDE.md)**: Orientation, the fast path, and compiler usage.
- **[Wesley Glossary](./docs/WESLEY_GLOSSARY.md)**: The main nouns, layers, and boundary terms for Wesley and its surrounding toolchain.
- **[Advanced Guide](./docs/ADVANCED_GUIDE.md)**: Deep dives into the IR model, custom directives, and the "Holmes" policy engine.
- **[Architecture](./docs/ARCHITECTURE.md)**: The authoritative system map (Base Platform, Modules, Workspace, and bundle pipeline).
- **[Realization Admission and Witness](./docs/design/0004-realization-admission-and-witness/realization-admission-and-witness.md)**: The release-line doctrine for authored source, IR, realization shells, and bounded witness claims.
- **[Module Contract](./docs/design/wesley-module-contract.md)**: The boundary between the Wesley compiler kernel and external target modules.
- **[Module Capability Contract](./docs/design/wesley-module-capability-contract.md)**: The capability surfaces external modules bring to Wesley.
- **[Extraction Map](./docs/design/wesley-extraction-map.md)**: The currently known wrong-repo domain residue and its intended external homes.
- **[Vision](./docs/VISION.md)**: Core tenets and the "Trustworthy Change" mission.
- **[Method](./docs/METHOD.md)**: Repo work doctrine and the cycle loop.

---
Built with bit-exact ambition by [FLYING ROBOTS](https://github.com/flyingrobots)
