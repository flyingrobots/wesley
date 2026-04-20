# Wesley
<!-- docs-truth: status=experimental owner=@flyingrobots -->

A schema-first contract compiler for trustworthy change. Wesley ensures that shared protocols, database migrations, and cross-language boundaries remain technically truthful through bit-exact code generation and evidence-backed conformance.

Wesley is designed for the systems architect who demands a sovereign boundary for their contracts. It scales from automated PostgreSQL migration planning to the compilation of the global Continuum causal protocol.

[![Overall](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/flyingrobots/wesley/main/meta/badges/overall.json)](README.md)
[![License](https://img.shields.io/github/license/wesley)](./LICENSE)

## Why Wesley?

Unlike traditional code-generators that treat schemas as suggestions, Wesley treats the schema as the sovereign system of record.

- **Contract Sovereignty**: Authored GraphQL SDL is the single source of truth. Generated artifacts (Rust, TS, SQL) are derived surfaces that are never allowed to become peer authorities.
- **Admission Discipline**: Authored source, lowered IR, realization shells, and witness output are kept distinct so Wesley can certify explicit properties without overstating runtime truth.
- **Evidence-Backed Change**: Commands like `plan`, `rehearse`, and `witness` produce machine-readable evidence that a proposed change is lawful, safe, and conformant.
- **Cross-Language Inevitability**: By generating bit-exact codecs and IR envelopes, Wesley prevents the "adapter spaghetti" that typically causes multi-repo platforms to rot.
- **Local-First Operation**: The compiler and witness suite run entirely on the local developer workstation, ensuring that contract verification is part of the fast inner-loop.

## Quick Start

### 1. Repository Preflight
Install dependencies and verify the local compiler health.
```bash
pnpm install
pnpm run preflight
```

### 2. Compile a Continuum Contract
Generate manifests and TypeScript targets for a shared causal family.
```bash
pnpm wesley compile \
  --schema ./schemas/continuum-receipt-family.graphql \
  --target warp-ttd,echo \
  --out-dir .wesley-cache/continuum/local-inspect
```

### 3. Verify the Realization Shell
Check that the emitted manifest still matches the authored source and signed artifacts.
```bash
pnpm wesley verify-realization \
  --out-dir .wesley-cache/continuum/local-inspect
```

### 4. Verify Conformance
Produce a bounded evidence witness to prove the generated artifacts match the authored truth for the selected scope.
```bash
pnpm wesley witness \
  --scope receipt-family \
  --schema ./schemas/continuum-receipt-family.graphql \
  --out-dir .wesley-cache/continuum/local-inspect
```

### 5. Release One Versioned Contract Bundle
Assemble one semver-tagged bundle that binds source identity, realization, witness output, and consumer sync projections together.
```bash
pnpm wesley contract release \
  --profile continuum \
  --family receipt-family \
  --schema ./schemas/continuum-receipt-family.graphql \
  --release 0.1.0
```

### 6. Prototype A WARPspace Bootstrap
Materialize the first Continuum demo WARPspace from a concrete stack release manifest.
```bash
node packages/wesley-host-node/bin/warpspace.mjs init ./tmp/continuum-app \
  --manifest ../continuum/docs/releases/demo/continuum-stack-release.json \
  --authority-root ../continuum
```

This first cut is intentionally local-first:

- it reads a concrete Continuum stack release manifest
- it writes `warpspace.toml` and `warpspace.lock.json`
- it materializes the selected shared family into the host repo
- it runs the first Wesley generation pass for the selected projections

## Overall Status

<!-- BEGIN:OVERALL_STATUS -->
Stage: MVP  \
Progress: 59% → Alpha
<!-- END:OVERALL_STATUS -->

## Package Matrix

<!-- BEGIN:PACKAGE_MATRIX -->
| Package | Status | Stage | Progress | CI | Notes |
| --- | --- | --- | --- | --- | --- |
| `@wesley/core` | Active | MVP | 45% → Alpha | — | Pure domain logic, no Node builtins |
| `@wesley/cli` | Active | Alpha | 50% → Beta | — | CLI + Bats suites |
| `@wesley/host-node` | Active | MVP | 50% → Alpha | — | Node adapters + binary |
| `@wesley/host-browser` | Experimental | MVP | 40% → Alpha | — | Pure ESM; in-memory FS; minimal parser; smoke-level only |
| `@wesley/generator-echo` | Active | MVP | 20% → Alpha | — | Echo IR + codec emitters |
| `@wesley/generator-js` | Active | MVP | 50% → Alpha | — | TS/Zod emitters |
| `@wesley/generator-supabase` | Active | MVP | 50% → Alpha | — | SQL/RLS/pgTAP emitters |
| `@wesley/generator-ttd` | Active | MVP | 20% → Alpha | — | TTD protocol + manifest emitters |
| `@wesley/generator-vue` | Experimental | MVP | 0% → Alpha | — | Vue-facing TS/composable emitters |
| `@wesley/holmes` | Active | Alpha | 50% → Beta | — | Evidence scoring |
| `@wesley/runtime-node` | Active | MVP | 0% → Alpha | — | Shared Node runtime adapters |
| `@wesley/tasks` | Active | MVP | 50% → Alpha | — | Planner utilities |
| `@wesley/slaps` | Active | MVP | 50% → Alpha | — | Scheduling/core utils |
| `@wesley/host-deno` | Experimental | Alpha | 50% → Beta | — | Deno host runtime (demo) |
| `@wesley/host-bun` | Experimental | Alpha | 50% → Beta | — | Bun host runtime (demo) |
| `@wesley/scaffold-multitenant` | Too soon | Prototype | 50% → MVP | — | Early scaffold, no CI yet |
| `@wesley/stack-supabase-nextjs` | Too soon | Prototype | 50% → MVP | — | Early stack template, no CI yet |
| `@wesley/test-fixtures` | Active | MVP | 20% → Alpha | — | Private shared fixtures + schema builders |
<!-- END:PACKAGE_MATRIX -->

## Documentation

- **[Guide](./docs/GUIDE.md)**: Orientation, the fast path, and compiler usage.
- **[Wesley Glossary](./docs/WESLEY_GLOSSARY.md)**: The main nouns, layers, and boundary terms for Wesley and its surrounding toolchain.
- **[Advanced Guide](./docs/ADVANCED_GUIDE.md)**: Deep dives into the IR model, custom directives, and the "Holmes" policy engine.
- **[Architecture](./docs/ARCHITECTURE.md)**: The authoritative system map (Base Platform, Modules, Workspace, and bundle pipeline).
- **[Realization Admission and Witness](./docs/design/0004-realization-admission-and-witness/realization-admission-and-witness.md)**: The release-line doctrine for authored source, IR, realization shells, and bounded witness claims.
- **[Contract Bundle Release and Sync](./docs/design/0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md)**: The release object, dual-versioning model, and cross-repo sync doctrine for Continuum families.
- **[WARPspace Workspace Resolution](./docs/design/0006-warpspace-workspace-resolution/warpspace-workspace-resolution.md)**: The host-project contract consumption model for generated outputs and local overrides.
- **[Vision](./docs/VISION.md)**: Core tenets and the "Trustworthy Change" mission.
- **[Method](./docs/METHOD.md)**: Repo work doctrine and the cycle loop.

---
Built with bit-exact ambition by [FLYING ROBOTS](https://github.com/flyingrobots)
