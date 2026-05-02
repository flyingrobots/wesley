# Wesley Extraction Map

This note names the non-generic code still living in the Wesley repo and
assigns each area the external home it must move to.

The rule set behind this map is simple:

- Wesley base platform should contain compiler and toolchain primitives that do
  not know about one product domain.
- Domain meaning should enter through modules.
- Product behavior belongs in the product repo or a product-owned module repo.
- Database/Postgres/Supabase behavior belongs in `wesley-postgres`, not in this
  repo.

The target is not "Wesley has cleaner built-in product lanes." The target is
"Wesley has no built-in product or database lanes."

## What Stays In Wesley

These areas are generic enough to remain in the Wesley repo:

- GraphQL parsing, canonicalization, hashing, lowering, and IR plumbing
- generator and module contracts
- generic artifact writing and bundle plumbing
- generic CLI framework and command registration
- generic Holmes, Watson, Moriarty, and BLADE engines
- generic host/runtime shims for Node, Bun, Deno, and browser execution

That means Wesley should continue to own things like:

- `packages/wesley-core/src/application/LoweringEngine.mjs`
- `packages/wesley-core/src/ports/GeneratorPlugin.mjs`
- `packages/wesley-core/src/ports/WesleyModule.mjs`
- `packages/wesley-cli/src/framework/`
- `packages/wesley-runtime-node/`

## What Is Still In The Wrong Place

### Post-Capability-Cut Inventory

Inventory date: 2026-05-02, after the module capability registry, module-driven
compile target discovery, and full fixture capability matrix landed.

This inventory is the deletion gate. Nothing below should be removed from
Wesley until its row has either an external home or a replacement module-backed
test path.

| Area | Current Wesley evidence | Classification | Cut guard |
| --- | --- | --- | --- |
| Generic `compile` command | `packages/wesley-cli/src/commands/compile.mjs` legacy `warp-ttd` and `echo` compatibility descriptors | Keep as legacy compatibility | Preserve until Continuum supplies equivalent module `wesley.targets` and existing compile tests can run through the module path. |
| TTD/Echo public CLI commands | `compile-ttd.mjs`, `bundle-echo.mjs`, `verify-realization.mjs`, `realization-integrity.mjs` | Relocate | Move into a Continuum-owned Wesley module command surface; do not delete while Bats coverage still exercises these commands directly. |
| WARPspace output lookup in CLI | `packages/wesley-cli/src/utils/warpspace.mjs`, `FileOutputGeneratorCommand.mjs`, `compile-ttd.mjs`, `bundle-echo.mjs` | Relocate | Move Continuum host-project config lookup out of generic CLI after command/module replacements own output defaults. |
| Stale module-owned command skip list | `MODULE_OWNED_COMMAND_FILES` entries for missing `contract.mjs`, `witness.mjs`, `witness-continuum.mjs`, `drift-watch.mjs`, `observer-plan.mjs` | Delete | Safe only with command auto-discovery regression coverage; no behavior deletion in this inventory slice. |
| WARPspace bootstrap program | `packages/wesley-host-node/bin/warpspace.mjs`, `src/warpspace-program.mjs`, `src/warpspace/init.mjs`, host-node `bin.warpspace` | Relocate | Move to Continuum `warp` ownership, then remove the Wesley bin or leave a clearly deprecated shim with a removal date. |
| Continuum generator packages | `packages/wesley-generator-echo/`, `packages/wesley-generator-ttd/` | Relocate | Move to Continuum-owned module/generator packages; keep while legacy commands import them. |
| TTD core package surface | `packages/wesley-core/src/ttd/`, `@wesley/core` exports `./ttd` and `./ttd/invariants` | Relocate | Needs a Continuum/TTD module package first because `@wesley/generator-ttd` tests and compile paths import this surface. |
| Continuum schemas | `schemas/ttd-protocol.graphql`, `schemas/ttd-ir.schema.json`, `schemas/echo-core-types.graphql`, `schemas/echo-wasm-abi.graphql`, `schemas/continuum-*.graphql` | Relocate | Move into Continuum-owned schema/module packages after CLI/generator tests stop using repo-local canonical copies. |
| Mixed directive schema | TTD directive block inside `schemas/directives.graphql` | Defer | Split only after generic directive ownership is clarified; do not break generic SDL parser fixtures incidentally. |
| Legacy Continuum tests | `compile.bats`, `compile-ttd.bats`, `bundle-echo.bats`, `verify-realization.bats`, `warpspace.*`, Continuum witness assertions | Keep as legacy compatibility | Keep as regression coverage until equivalent module-backed tests cover the transferred behavior. |
| CLI dependency on Echo generator | `packages/wesley-cli/package.json` depends on `@wesley/generator-echo` | Keep as legacy compatibility | Remove only after `bundle-echo` and legacy compile descriptors no longer import the package from Wesley. |
| PostgreSQL-family core exports | `packages/wesley-core/src/index.mjs`, `typeMapping.mjs`, `PostgreSQLGenerator.mjs`, `PgTAPTestGenerator.mjs`, migration explainer/planner/orchestrator, QIR Postgres dialect | Relocate | Move to `wesley-postgres`; keep generic QIR contracts only after the Postgres dialect split is explicit. |
| PostgreSQL/Supabase packages | `packages/wesley-generator-supabase/`, `packages/wesley-stack-supabase-nextjs/` | Relocate | Move to `wesley-postgres` or a stack repo; root/package metadata follows after package removal. |
| PostgreSQL/Supabase host/runtime coupling | `packages/wesley-host-node/src/adapters/ConfigLoader.mjs`, `DbAdapter.mjs`, `createNodeRuntime.mjs`, compiler adapters, `packages/wesley-runtime-node/src/CounterfactualSurface.mjs` | Relocate | Move Node database helpers under `wesley-postgres-node`; keep generic host shims in Wesley. |
| PostgreSQL fixtures and smoke scripts | `docker-compose.fixture-test.yml`, `scripts/smoke/postgres-fixture.sh`, `scripts/smoke/holmes-ops-pgtap.sh`, `test/fixtures/postgres/` | Defer | These are test harnesses for current database behavior; move with the database package split, not in the Continuum cleanup slice. |
| Root PostgreSQL parser dependency | root `package.json`, `packages/wesley-core/package.json`, lockfile entries for `@supabase/pg-parser` | Relocate | Remove from Wesley only after all direct core/generator imports move to `wesley-postgres`. |
| Holmes `git-warp` provider | `packages/wesley-holmes/src/counterfactual/provider.mjs`, `policy.mjs`, `@git-stunts/*` deps | Relocate | Move provider/policy defaults into Continuum/module ownership after Holmes has a module capability seam for counterfactual providers. |
| Product/database backlog and docs | active backlog/inbox items naming Continuum, Supabase, Postgres, Echo, TTD as Wesley work | Defer | Triage after code ownership moves; historical retro and changelog entries stay as history, not active doctrine. |

### 1. Continuum target semantics still sit inside generic compile flows

Evidence:

- `packages/wesley-cli/src/commands/compile.mjs`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/src/commands/verify-realization.mjs`
- `packages/wesley-cli/src/commands/realization-integrity.mjs`
- `packages/wesley-cli/src/utils/warpspace.mjs`

Why it is non-generic:

- `compile.mjs` is now a core Wesley dispatcher that discovers module targets,
  but it still carries `warp-ttd` and `echo` as compatibility descriptors.
- `compile-ttd.mjs` is a TTD-specific compile surface.
- `bundle-echo.mjs` is an Echo-specific bundle surface with mocked
  `warp-ttd` deliveries.
- `verify-realization.mjs` and `realization-integrity.mjs` encode a specific
  two-leg realization model with `warp-ttd` and `echo`.
- `warpspace.mjs` resolves `warpspace.toml`, which is a Continuum host-project
  convention, not a generic Wesley concept.

New home:

- keep `compile.mjs` in Wesley as the generic module/target dispatcher
- remove its `warp-ttd`/`echo` descriptors only after Continuum supplies module
  targets with equivalent coverage
- move `compile-ttd.mjs` and `bundle-echo.mjs` into `continuum/wesley/commands/`
- move `verify-realization.mjs` and `realization-integrity.mjs` into the
  Continuum Wesley module as the Continuum realization verifier
- move `warpspace.mjs` into `continuum/wesley/utils/`

Result:

- generic Wesley keeps `compile` as a generic compile surface
- Continuum owns the multi-target compile surface for `echo` and `warp-ttd`

### 2. WARPspace bootstrap lives in `wesley-host-node`

Evidence:

- `packages/wesley-host-node/src/warpspace-program.mjs`
- `packages/wesley-host-node/src/warpspace/init.mjs`
- `packages/wesley-host-node/bin/warpspace.mjs`

Why it is non-generic:

- the CLI literally describes itself as
  "Bootstrap a Continuum consumer workspace"
- the init flow reads a Continuum stack-release manifest
- it materializes contract families into a host project
- it invokes `bundle-echo` and `compile-ttd`

New home:

- move the `warpspace` program and init flow into `continuum/apps/warp/`

Result:

- `warp` becomes the real Continuum-owned workspace bootstrap tool
- `wesley-host-node` goes back to being a generic host surface

### 3. Continuum generator packages are still in Wesley

Evidence:

- `packages/wesley-generator-echo/`
- `packages/wesley-generator-ttd/`

Why it is non-generic:

- these generators exist specifically for Continuum submodules
- they encode Echo and TTD semantics, not generic tech-platform behavior

New home:

- move them under the Continuum-owned Wesley module surface, for example:
  - `continuum/wesley/generators/echo/`
  - `continuum/wesley/generators/ttd/`
  - or another Continuum-owned package/repo with no Wesley-workspace package

Result:

- the Continuum module owns its own generators
- Wesley keeps only generator contracts and generic generator infrastructure

### 3a. TTD core internals are still exported from `wesley-core`

Evidence:

- `packages/wesley-core/src/ttd/`
- `packages/wesley-core/package.json` exports `./ttd` and `./ttd/invariants`
- `packages/wesley-generator-ttd/` imports those surfaces in tests

Why it is non-generic:

- the TTD parser, codegen, manifest, and invariant language are protocol-family
  semantics rather than base compiler machinery
- the `@wesley/core/ttd` export makes the base package look like the canonical
  TTD module home

New home:

- move TTD internals into a Continuum-owned package or module surface
- keep only generic module/generator contracts in `wesley-core`

Result:

- Continuum owns TTD protocol generation
- Wesley no longer exports protocol-family internals from core

### 4. Database and Postgres semantics leak out of `wesley-core`

Evidence:

- `packages/wesley-core/src/index.mjs`
- `packages/wesley-core/src/domain/typeMapping.mjs`
- `packages/wesley-core/src/application/MigrationPlan.mjs`
- `packages/wesley-core/src/domain/explainer/MigrationExplainer.mjs`
- `packages/wesley-core/src/domain/orchestrator/CICOrchestrator.mjs`
- `packages/wesley-core/src/domain/generators/PostgreSQLGenerator.mjs`
- `packages/wesley-core/src/domain/generators/PgTAPTestGenerator.mjs`
- `packages/wesley-core/src/domain/analyzer/DefaultAnalyzer.mjs`
- `packages/wesley-core/src/domain/analyzer/ConcurrentSafetyAnalyzer.mjs`
- `packages/wesley-core/src/domain/qir/`

Why it is non-generic:

- `wesley-core` currently exports direct GraphQL-to-Postgres type mapping
- it exports Postgres generators directly from the base package
- it contains migration explainers, lock levels, and CIC orchestration
- it contains database-specific analyzer logic and QIR/Postgres naming rules

New home:

- create a PostgreSQL-family extraction repo:
  - `wesley-postgres`

Suggested split:

- `wesley-postgres/packages/postgres`
  - GraphQL/Postgres type mapping
  - Postgres lock semantics
  - Postgres analyzers
  - PgTAP generation
  - PostgreSQL-specific QIR emission rules
- `wesley-postgres/packages/supabase`
  - Supabase-specific generation and policy behavior

Result:

- `wesley-core` becomes a real base compiler package
- PostgreSQL-family behavior gets its own repo instead of lingering anywhere in
  Wesley

### 5. Database runtime adapters live in generic host-node

Evidence:

- `packages/wesley-host-node/src/adapters/DbAdapter.mjs`
- `packages/wesley-host-node/src/adapters/ConfigLoader.mjs`
- `packages/wesley-host-node/src/adapters/createNodeRuntime.mjs`
- `packages/wesley-host-node/src/adapters/compiler-inprocess.mjs`
- `packages/wesley-host-node/src/adapters/inprocess-compiler.mjs`
- `packages/wesley-runtime-node/src/CounterfactualSurface.mjs`

Why it is non-generic:

- these adapters assume SQL/PostgreSQL execution and generated SQL/test output
- `ConfigLoader` includes database-lane defaults like pgTAP generation
- `createNodeRuntime.mjs` imports `@wesley/generator-supabase`

New home:

- move these adapters under `wesley-postgres`
  - initial target: `packages/wesley-postgres-node`
  - remaining mixed host-node/database config should follow later

Result:

- `wesley-host-node` remains a generic host package
- Node-specific database helpers still exist, but under the database module

### 5a. Supabase/PostgreSQL packages are still in Wesley

Evidence:

- `packages/wesley-generator-supabase/`
- `packages/wesley-stack-supabase-nextjs/`
- `packages/wesley-host-node/package.json`
- `packages/wesley-runtime-node/package.json`
- root `package.json`

Why it is non-generic:

- the generator package emits PostgreSQL DDL, RLS, and pgTAP tests
- the stack package describes a Supabase + Next.js template
- root and runtime package metadata still pull in PostgreSQL/Supabase tooling

New home:

- move PostgreSQL/Supabase generation into `wesley-postgres`
- move stack-specific scaffolding into `wesley-postgres` or a stack-owned repo

Result:

- database package ownership becomes explicit
- Wesley package metadata stops implying PostgreSQL/Supabase is core

### 6. Holmes has a `git-warp` counterfactual provider in generic shared code

Evidence:

- `packages/wesley-holmes/src/counterfactual/provider.mjs`
- `packages/wesley-holmes/src/counterfactual/policy.mjs`
- `packages/wesley-holmes/package.json`

Why it is non-generic:

- the provider imports `@git-stunts/plumbing`
- it imports `@git-stunts/git-warp`
- the default provider is literally `git-warp`

New home:

- move this provider and its policy defaults into the Continuum module, for
  example:
  - `continuum/wesley/holmes/counterfactual/provider.mjs`
  - `continuum/wesley/holmes/counterfactual/policy.mjs`

Result:

- Holmes stays a generic engine
- Continuum supplies a Continuum-specific counterfactual provider

## Extraction Order

The safest order is:

1. keep `compile.mjs` as the module-owned target dispatcher and treat
   `warp-ttd`/`echo` as temporary compatibility descriptors
2. move the remaining Continuum compile/generator/schema surfaces into
   `continuum/wesley/`
3. move WARPspace bootstrap into `continuum/apps/warp/`
4. move the Holmes `git-warp` counterfactual provider into Continuum
5. carve database behavior out of `wesley-core`
6. move Node/Postgres adapters out of `wesley-host-node`

This order matters because the Continuum extraction is conceptually settled
already, while the database module split still needs more package shaping.

## Short-Term Rules

Until the extractions land:

- do not add new Continuum behavior to generic Wesley packages
- do not add new Postgres/Supabase behavior to `wesley-core`
- add new domain behavior only behind an explicit module boundary

## Target State

The end state should look like this:

- Wesley repo
  - base platform
  - generic tools
  - generic extension/module contracts
  - hermetic fixture modules for tests
- Continuum repo
  - Continuum Wesley module
  - Continuum generators
  - Continuum Holmes/Watson/Moriarty/BLADE extensions
  - `warp` workspace/bootstrap tool
- database module packages
  - database / postgres / supabase semantics
  - Node-specific adapters where needed

That is the split that lets Wesley stay lean without deleting useful
domain-specific work. The work moves to its owning repo instead of remaining
in the core compiler workspace.
