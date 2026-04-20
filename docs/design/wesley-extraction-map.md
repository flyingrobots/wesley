# Wesley Extraction Map

This note names the non-generic code still living in the Wesley repo and
assigns each area a better long-term home.

The rule set behind this map is simple:

- Wesley base platform should contain compiler and toolchain primitives that do
  not know about one product domain.
- Domain meaning should enter through modules.
- Continuum-owned behavior belongs in the Continuum repo.
- Database/Postgres/Supabase behavior belongs in database modules, not in
  `wesley-core`.

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

### 1. Continuum target semantics are still hard-coded into generic compile flows

Evidence:

- `packages/wesley-cli/src/commands/compile.mjs`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/src/commands/verify-realization.mjs`
- `packages/wesley-cli/src/commands/realization-integrity.mjs`
- `packages/wesley-cli/src/utils/warpspace.mjs`

Why it is non-generic:

- `compile.mjs` is a core Wesley verb, but its current implementation
  hard-codes `warp-ttd` and `echo` as the valid targets instead of discovering
  targets from loaded modules.
- `compile-ttd.mjs` is a TTD-specific compile surface.
- `bundle-echo.mjs` is an Echo-specific bundle surface with mocked
  `warp-ttd` deliveries.
- `verify-realization.mjs` and `realization-integrity.mjs` encode a specific
  two-leg realization model with `warp-ttd` and `echo`.
- `warpspace.mjs` resolves `warpspace.toml`, which is a Continuum host-project
  convention, not a generic Wesley concept.

New home:

- keep `compile.mjs` in Wesley, but rewrite it as a generic module/target
  dispatcher
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

Result:

- the Continuum module owns its own generators
- Wesley keeps only generator contracts and generic generator infrastructure

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
- PostgreSQL-family behavior gets its own repo instead of lingering in core

### 5. Database runtime adapters live in generic host-node

Evidence:

- `packages/wesley-host-node/src/adapters/PostgreSQLAdapter.mjs`
- `packages/wesley-host-node/src/adapters/PgParserAdapter.mjs`
- `packages/wesley-host-node/src/adapters/SQLExecutor.mjs`
- `packages/wesley-host-node/src/adapters/ConfigLoader.mjs`

Why it is non-generic:

- these adapters assume PostgreSQL parsing and execution
- `ConfigLoader` includes database-lane defaults like pgTAP generation

New home:

- move these adapters under `wesley-postgres`
  - initial landed slice: `packages/wesley-postgres-node`
  - remaining mixed host-node/database config should follow later

Result:

- `wesley-host-node` remains a generic host package
- Node-specific database helpers still exist, but under the database module

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

1. rewrite `compile.mjs` to discover module-owned targets instead of
   hard-coding Continuum targets
2. move the remaining Continuum compile/generator surfaces into
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
  - generic tech modules
- Continuum repo
  - Continuum Wesley module
  - Continuum generators
  - Continuum Holmes/Watson/Moriarty/BLADE extensions
  - `warp` workspace/bootstrap tool
- database module packages
  - database / postgres / supabase semantics
  - Node-specific adapters where needed

That is the split that lets Wesley stay lean without deleting useful
domain-specific work.
