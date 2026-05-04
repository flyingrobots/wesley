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

This inventory is the deletion gate. Each implementation slice should name the
row it is deleting or relocating, then leave Wesley with a covered generic path
or no advertised product surface.

| Area | Current Wesley evidence | Classification | Cut guard |
| --- | --- | --- | --- |
| Generic `compile` command | `packages/wesley-cli/src/commands/compile.mjs` | Done for built-in targets | `compile` now uses module-provided `wesley.targets` only; remaining cleanup is removing standalone Continuum commands and packages. |
| TTD/Echo public CLI commands | removed `compile-ttd.mjs`, `bundle-echo.mjs`, their CLI Bats suites, and the command-only TTD fixture | Done | Recreate only as Continuum-owned module commands or external packages if still needed; generic Wesley no longer ships those public product commands. |
| Continuum realization verifier | removed `verify-realization.mjs`, `realization-integrity.mjs`, root `verify:realization`, the stale pre-commit hook invocation, `verify-realization.bats`, and compile-dependent witness assertions | Done | Wesley no longer advertises, tests, or hook-runs a built-in two-leg Continuum realization verifier. Recreate only as a Continuum-owned module surface. |
| WARPspace output lookup in CLI | removed `packages/wesley-cli/src/utils/warpspace.mjs`, `--warpspace` options, WARPspace-backed file/root defaults, WARPspace CLI tests, and `smol-toml` dependency | Done | Generic Wesley generators now use explicit `--out-file`; the later-deleted Continuum commands used explicit `--out-dir` or local defaults while they existed. Continuum-owned modules/tools should own host-project output defaults. |
| Stale module-owned command skip list | removed `MODULE_OWNED_COMMAND_FILES` entries for missing `contract.mjs`, `witness.mjs`, `witness-continuum.mjs`, `drift-watch.mjs`, `observer-plan.mjs` | Done | Command auto-discovery now only skips private/helper files; external module commands register through loaded modules. |
| WARPspace bootstrap program | removed `packages/wesley-host-node/bin/warpspace.mjs`, `src/warpspace-program.mjs`, `src/warpspace/init.mjs`, host-node `bin.warpspace`, and residue tests/backlog notes | Done | Continuum `warp` owns workspace bootstrap; Wesley host-node now keeps only the generic `wesley` binary. |
| Continuum generator packages | removed `packages/wesley-generator-echo/`, empty `packages/wesley-generator-ttd/`, their workspace metadata, and package-local tests/fixtures | Done | Recreate Echo or TTD generators only in a Continuum-owned module/repo. Generic Wesley keeps generator contracts, not product generators. |
| TTD core package surface | moved `packages/wesley-core/src/ttd/` to `continuum/wesley/ttd/`, removed `@wesley/core` exports `./ttd` and `./ttd/invariants`, and kept generic `@wes_join` validation in `packages/wesley-core/src/domain/joinDirective.mjs` | Done | Continuum owns TTD protocol generation; generic Wesley no longer exports protocol-family internals from core. |
| Continuum shared family compatibility copies | removed Wesley-local `schemas/continuum-receipt-family.graphql` and `schemas/continuum-settlement-family.graphql`; Continuum owns `schemas/continuum-receipt-family.graphql` and `schemas/continuum-settlement-family.graphql` | Done | Wesley no longer keeps compatibility copies of Continuum-authored shared families. |
| TTD protocol schema | removed Wesley-local `schemas/ttd-protocol.graphql`; `warp-ttd` owns `schemas/warp-ttd-protocol.graphql` | Done | Missing old Wesley protocol nouns should become `warp-ttd` protocol-evolution work, not a second Wesley schema authority. |
| Echo runtime/CAS/ABI schemas | removed Wesley-local `schemas/echo-core-types.graphql` and `schemas/echo-wasm-abi.graphql`; Echo tracks reconciliation in `docs/method/backlog/inbox/PLATFORM_reconcile-relocated-wesley-echo-schemas.md` instead of committing stale SDL as active truth | Done | Echo owns Echo-local runtime, CAS, and WASM ABI schema truth; old Wesley SDL concepts must be re-authored there only if they still match current Echo truth. |
| TTD IR schema | moved Wesley-local `schemas/ttd-ir.schema.json` to `continuum/wesley/ttd/schemas/ttd-ir.schema.json` | Done | The TTD IR schema belongs beside the Continuum-owned TTD compiler module, not generic Wesley core. |
| Mixed directive schema | removed TTD directive SDL from Wesley `schemas/directives.graphql`; Continuum owns `wesley/ttd/schemas/ttd-directives.graphql` beside its TTD parser | Done | Generic Wesley's directive registry no longer declares `@wes_channel`, `@wes_op`, `@wes_rule`, `@wes_footprint`, or related TTD-only directives. |
| Legacy Continuum tests | removed `compile-ttd.bats`, `bundle-echo.bats`, root `compile-ttd` composition cases, `warpspace.*`, `verify-realization.bats`, and stale Continuum witness assertions | Done | Generic Wesley no longer keeps Bats coverage for removed Continuum product commands. |
| CLI dependency on Echo generator | removed `packages/wesley-cli` dependency on `@wesley/generator-echo` and the lockfile importer edge | Done | The generic CLI no longer imports or declares Echo; the Echo package was removed in the Continuum generator package slice. |
| Doctor hard-coded product generator list | removed unused `_WELL_KNOWN_GENERATORS` from `packages/wesley-cli/src/commands/doctor-checks.mjs` | Done | Doctor discovers workspace generator packages dynamically or reads `config.generators`; it no longer names Echo, TTD, or Supabase as built-in well-known generators. |
| PostgreSQL-family core exports | removed `@wesley/core` exports and implementation files for type mapping, PostgreSQL/PgTAP generation, migration planning/explainers/verifiers, SQL AST/CST/backend helpers, QIR SQL/Postgres lowering, SQL/test/diff ports, advisory locks, transaction helpers, PostgreSQL sanitizers, and database safety validation; `wesley-postgres` owns the relocated core primitives | Done | Generic Wesley core no longer exports PostgreSQL-family generators, migration planners, database ports, database safety helpers, or QIR SQL dialect internals. |
| Supabase generator package | removed Wesley-local `packages/wesley-generator-supabase/`, its package-local workflow, test harness, CODEOWNERS entry, workspace lockfile importer, progress metadata, and workspace dependency edges; `wesley-postgres` owns `packages/wesley-generator-supabase/` | Done | Generic Wesley no longer ships the Supabase generator package. Remaining Postgres core/runtime emitters are tracked by the separate core-export and host/runtime coupling rows. |
| Supabase/Next stack package | removed Wesley-local `packages/wesley-stack-supabase-nextjs/`, its CODEOWNERS entry, architecture boundary required-package entry, progress metadata, and lockfile importer; `wesley-postgres` owns `packages/wesley-stack-supabase-nextjs/` | Done | Generic Wesley no longer ships the Supabase + Next.js stack template. |
| PostgreSQL/Supabase host/runtime coupling | removed Node database config/adapter/compiler files and Postgres generator adapters; `createNodeRuntime.mjs` now exposes generic parsing, JS generators, event store, filesystem, and writer shims; `wesley-postgres-node` owns the relocated database helpers | Done | Generic host/runtime packages no longer synthesize PostgreSQL outputs or wire database generators. |
| PostgreSQL lock-aware execution package | removed `packages/wesley-slaps/`, the optional `@wesley/slaps` host-node import, package workflow, CODEOWNERS entry, and active docs that advertised SLAPS as a generic Wesley package; `wesley-postgres` owns `packages/wesley-postgres-slaps/` | Done | Wesley keeps generic `@wesley/tasks` planning and task graph descriptors; PostgreSQL SQL execution, lock matrices, deadlock handling, and `pg` pool integration belong to `wesley-postgres`. |
| PostgreSQL fixtures and smoke scripts | removed root Postgres Docker compose files, Postgres/QIR schemas, QIR docs, Postgres smoke scripts, QIR/ops fixtures, pgTAP examples, and database E2E harness files; `wesley-postgres` owns the moved copies | Done | Database fixture and smoke coverage now belongs to the database repo. |
| Root PostgreSQL parser dependency | removed root and `@wesley/core` `@supabase/pg-parser` dependencies, lockfile entries, and stale `packages/wesley-core/package-lock.json` | Done | Wesley package metadata no longer implies PostgreSQL parsing is part of the base platform. |
| Holmes `git-warp` provider | `packages/wesley-holmes/src/counterfactual/provider.mjs`, `policy.mjs`, removed `@git-stunts/*` deps | Done | Holmes now dispatches counterfactual analysis through `holmes.counterfactualProviders`; generic Holmes has no built-in `git-warp` provider or default. |
| Product/database backlog and docs | moved active Postgres/QIR/Supabase backlog notes, QIR specs/guides/drafts, and database smoke docs to `wesley-postgres`; patched active Wesley docs to describe generic artifact/transmutation behavior | Done | Active database work is now owned by the database repo. Historical audit, retro, and changelog mentions remain history rather than current Wesley doctrine. |

### 1. Continuum target semantics still sit inside generic compile flows

Evidence:

- `packages/wesley-cli/src/commands/compile.mjs`
- removed `packages/wesley-cli/src/commands/compile-ttd.mjs`
- removed `packages/wesley-cli/src/commands/bundle-echo.mjs`
- removed `packages/wesley-cli/src/utils/warpspace.mjs`

Removed in the first cleanup slice:

- `packages/wesley-cli/src/commands/verify-realization.mjs`
- `packages/wesley-cli/src/commands/realization-integrity.mjs`
- `packages/wesley-cli/test/verify-realization.bats`
- `packages/wesley-cli/test/witness.bats`

Why it is non-generic:

- `compile.mjs` is now a core Wesley dispatcher that discovers module targets
  only.
- removed `compile-ttd.mjs` was a TTD-specific compile surface.
- removed `bundle-echo.mjs` was an Echo-specific bundle surface with mocked
  `warp-ttd` deliveries.
- removed `warpspace.mjs` resolved `warpspace.toml`, which is a Continuum
  host-project convention, not a generic Wesley concept.

New home:

- keep `compile.mjs` in Wesley as the generic module/target dispatcher
- recreate `compile-ttd.mjs` and `bundle-echo.mjs` only in
  `continuum/wesley/commands/` or another Continuum-owned module/package
- recreate the Continuum realization verifier only in the Continuum Wesley
  module if it is still needed
- removed Wesley's generic CLI WARPspace lookup; Continuum-owned tools should
  own host-project output defaults

Result:

- generic Wesley keeps `compile` as a generic compile surface
- generic Wesley no longer exposes a Continuum realization verifier
- generic Wesley no longer exposes TTD/Echo public CLI commands
- Continuum should own any future multi-target compile surface for `echo` and
  `warp-ttd`

### 2. WARPspace bootstrap lived in `wesley-host-node`

Evidence:

- removed `packages/wesley-host-node/src/warpspace-program.mjs`
- removed `packages/wesley-host-node/src/warpspace/init.mjs`
- removed `packages/wesley-host-node/bin/warpspace.mjs`
- removed `packages/wesley-host-node/test/warpspace-init.test.mjs`
- removed host-node `bin.warpspace`

Why it is non-generic:

- the CLI described itself as
  "Bootstrap a Continuum consumer workspace"
- the init flow read a Continuum stack-release manifest
- it materialized contract families into a host project
- it invoked `bundle-echo` and `compile-ttd`

New home:

- Continuum `warp` owns this bootstrap path

Result:

- `warp` becomes the real Continuum-owned workspace bootstrap tool
- `wesley-host-node` goes back to being a generic host surface

### 3. Continuum generator package residue remains in Wesley

Evidence:

- removed `packages/wesley-generator-echo/`
- removed `packages/wesley-generator-ttd/`, which had no `src/`
  implementation despite exporting `src/index.mjs`

Why it is non-generic:

- these generators exist specifically for Continuum submodules
- they encode Echo and TTD semantics, not generic tech-platform behavior

New home:

- move them under the Continuum-owned Wesley module surface, for example:
  - `continuum/wesley/generators/echo/`
  - `continuum/wesley/generators/ttd/`
  - or another Continuum-owned package/repo with no Wesley-workspace package

Result:

- the empty TTD generator package shell no longer advertises a Wesley-owned
  package
- the Echo generator package no longer advertises a Wesley-owned Continuum
  implementation
- the earlier Echo lint and golden fixture fixes kept the package valid until
  the package deletion slice
- the generic CLI no longer imports Echo through `bundle-echo`
- Continuum owns any future Echo or TTD generators
- Wesley keeps only generator contracts and generic generator infrastructure

### 3a. TTD core internals moved out of `wesley-core`

Moved out:

- removed `packages/wesley-core/src/ttd/`
- removed `packages/wesley-core/package.json` exports `./ttd` and
  `./ttd/invariants`
- moved the TTD compiler implementation to `continuum/wesley/ttd/`
- rewired Continuum's `warp-ttd` compile target and witness hash helper to the
  Continuum-owned implementation
- kept generic `@wes_join` validation in
  `packages/wesley-core/src/domain/joinDirective.mjs`

Why it is non-generic:

- the TTD parser, codegen, manifest, and invariant language are protocol-family
  semantics rather than base compiler machinery
- the `@wesley/core/ttd` export makes the base package look like the canonical
  TTD module home

New home:

- `continuum/wesley/ttd/`

Result:

- Continuum owns TTD protocol generation
- Wesley no longer exports protocol-family internals from core

### 4. Database and Postgres semantics moved out of `wesley-core`

Moved out:

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
- removed `packages/wesley-core/src/ports/sqlgen.mjs`
- removed `packages/wesley-core/src/ports/testgen.mjs`
- removed `packages/wesley-core/src/ports/diff.mjs`
- removed PostgreSQL advisory lock, transaction, sanitizer, and safety
  validation helpers

Why it is non-generic:

- `wesley-core` currently exports direct GraphQL-to-Postgres type mapping
- it exports Postgres generators directly from the base package
- it contains migration explainers, lock levels, and CIC orchestration
- it contains database-specific analyzer logic and QIR/Postgres naming rules
- it contained database execution safety helpers and SQL-specific port contracts

New home:

- `wesley-postgres`
  - GraphQL/Postgres type mapping
  - Postgres lock semantics
  - Postgres analyzers
  - PgTAP generation
  - PostgreSQL-specific QIR emission rules
  - migration planning, explainers, verifiers, and repair/rollback helpers
  - database safety, locking, transaction, sanitizer, and SQL/test/diff ports

Result:

- `wesley-core` becomes a real base compiler package
- PostgreSQL-family behavior gets its own repo instead of lingering anywhere in
  Wesley

### 5. Database runtime adapters moved out of generic host/runtime packages

Moved out:

- `packages/wesley-host-node/src/adapters/DbAdapter.mjs`
- `packages/wesley-host-node/src/adapters/ConfigLoader.mjs`
- `packages/wesley-host-node/src/adapters/createNodeRuntime.mjs`
- `packages/wesley-host-node/src/adapters/compiler-inprocess.mjs`
- `packages/wesley-host-node/src/adapters/inprocess-compiler.mjs`
- `packages/wesley-runtime-node/src/PostgresGeneratorAdapters.mjs`

Why it is non-generic:

- these adapters assume SQL/PostgreSQL execution and generated SQL/test output
- `ConfigLoader` includes database-lane defaults like pgTAP generation
- old `createNodeRuntime.mjs` wiring loaded PostgreSQL-family generator adapters
- old runtime-node counterfactual collection synthesized database outputs

New home:

- `wesley-postgres/packages/wesley-postgres-node`

Result:

- `wesley-host-node` remains a generic host package
- Node-specific database helpers still exist, but under the database repo
- `packages/wesley-runtime-node/src/CounterfactualSurface.mjs` remains in
  Wesley only as a generic collector for existing workspace artifacts

### 5a. Supabase packages moved out of Wesley

Evidence:

- removed `packages/wesley-generator-supabase/`
- removed `packages/wesley-stack-supabase-nextjs/`
- `packages/wesley-host-node/package.json`
- `packages/wesley-runtime-node/package.json`
- root `package.json`

Why it is non-generic:

- the removed generator package emitted PostgreSQL DDL, RLS, and pgTAP tests
- the removed stack package described a Supabase + Next.js template
- root and runtime package metadata still pull in PostgreSQL/Supabase tooling

New home:

- PostgreSQL/Supabase generation package now lives in `wesley-postgres`
- Supabase + Next.js stack package now lives in `wesley-postgres`

Result:

- database generator package ownership is explicit
- database stack template ownership is explicit
- Wesley package metadata stops implying PostgreSQL/Supabase is core

### 5b. PostgreSQL lock-aware execution moved out of Wesley

Moved out:

- `packages/wesley-slaps/`
- `.github/workflows/pkg-slaps.yml`
- the optional `@wesley/slaps` load path in
  `packages/wesley-host-node/src/adapters/createNodeRuntime.mjs`
- active docs and metadata that listed `@wesley/slaps` as a Wesley package

Why it is non-generic:

- the executor classifies SQL statements by PostgreSQL lock behavior
- it embeds PostgreSQL lock levels such as `ACCESS_EXCLUSIVE` and
  `SHARE_UPDATE_EXCLUSIVE`
- it handles PostgreSQL-specific behavior such as `CREATE INDEX CONCURRENTLY`,
  `SET lock_timeout`, transaction SQL, and deadlock code `40P01`
- it expects a `pg`-style connection pool

New home:

- `wesley-postgres/packages/wesley-postgres-slaps/`

Result:

- `@wesley/tasks` remains in Wesley as the generic DAG and task abstraction
- `TransmutationRunner.buildTaskGraph()` remains in Wesley as the generic task
  descriptor surface
- PostgreSQL lock-aware execution belongs to `wesley-postgres`

### 6. Holmes counterfactual provider moved behind module capabilities

Removed from generic Wesley:

- direct `@git-stunts/plumbing` and `@git-stunts/git-warp` imports from
  `packages/wesley-holmes/src/counterfactual/provider.mjs`
- direct `@git-stunts/*` dependencies from `packages/wesley-holmes/package.json`
- the `git-warp` default provider from the Holmes counterfactual policy

Generic Wesley now keeps:

- `holmes.counterfactualProviders` as a module capability collection
- a Holmes dispatcher that selects the configured provider or the sole loaded
  provider
- a typed unsupported report when no provider module is loaded

New home:

- recreate the `git-warp` provider in the Continuum module or another
  Continuum-owned module repo if it is still needed, for example:
  - `continuum/wesley/holmes/counterfactual/provider.mjs`
  - `continuum/wesley/holmes/counterfactual/policy.mjs`

Result:

- Holmes stays a generic engine
- Continuum supplies a Continuum-specific counterfactual provider

## Extraction Order

Completed order:

1. keep `compile.mjs` as the module-owned target dispatcher with no built-in
   product targets
2. move or delete the remaining Continuum compile/generator/schema surfaces out
   of Wesley into
   `continuum/wesley/`
3. keep WARPspace bootstrap out of `wesley-host-node`; Continuum `warp` owns it
4. move the Holmes `git-warp` counterfactual provider into Continuum
5. carve database behavior out of `wesley-core`
6. move Node/Postgres adapters out of `wesley-host-node`

All six extraction-order items are complete in Wesley. Future product behavior
should enter through external modules, not as new generic package imports.

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
