# Delete remaining product leftovers after capability cut

- Lane: `up-next`
- Legend: `OWN`
- Rank: `2`

## Why now

The first product-module extraction happened, but not the whole one.

What moved out already:

- product CLI/profile ownership
- product module home in the owning repo

What is still lingering in Wesley:

- product-shaped compile helpers
- realization verification helpers
- product workspace utilities and bootstrap residue
- product generators that still live in the wrong repo

Those leftovers should not be ripped out blindly before the module capability
runtime and module-driven compile path exist. But once those exist, the old
bootstrap residue should stop lingering.

## Hill

Wesley no longer carries product-specific execution residue after the module
capability runtime and module-driven compile target discovery are in place.

## Done looks like

- the remaining product-specific compile/realization helpers have a real home
  in the owning product repo
- Wesley no longer carries old product workspace bootstrap residue
- stale docs and internal imports that still imply Wesley-owned product
  behavior are removed
- the extraction map can mark the product leftovers as complete rather than
  still-active debt

## Current Slice Status

Inventory is now explicit in
`docs/design/wesley-extraction-map.md#post-capability-cut-inventory`.

Product/database code deletion has started after the inventory slice. The
inventory classifies each remaining surface as:

- `delete`
- `relocate`

There is no product legacy-support requirement. Each implementation slice should
pick one classified row and either remove it from Wesley or prove that its
external home already owns it.

## Repo Evidence

Seed evidence for this card is below. The complete post-capability-cut
classification lives in the extraction map inventory linked above.

- `docs/design/wesley-extraction-map.md`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/src/utils/warpspace.mjs`
- `packages/wesley-generator-echo/`

Deleted in the first cleanup slice:

- generic `compile` compatibility descriptors for `warp-ttd` and `echo`
- `packages/wesley-cli/src/commands/verify-realization.mjs`
- `packages/wesley-cli/src/commands/realization-integrity.mjs`
- root `verify:realization`
- stale `.githooks/pre-commit` invocation of root `verify:realization`
- stale Continuum witness and realization Bats coverage
- stale module-owned command skip-list entries for missing product commands

Deleted in the doctor cleanup slice:

- unused hard-coded `@wesley/generator-echo`, `@wesley/generator-ttd`, and
  `@wesley/generator-supabase` well-known generator list in
  `packages/wesley-cli/src/commands/doctor-checks.mjs`

Deleted in the WARPspace bootstrap cleanup slice:

- `packages/wesley-host-node/bin/warpspace.mjs`
- `packages/wesley-host-node/src/warpspace-program.mjs`
- `packages/wesley-host-node/src/warpspace/init.mjs`
- `packages/wesley-host-node/test/warpspace-init.test.mjs`
- host-node `bin.warpspace`
- obsolete WARPspace bootstrap bad-code backlog notes

Deleted in the WARPspace output lookup cleanup slice:

- `packages/wesley-cli/src/utils/warpspace.mjs`
- `packages/wesley-cli/test/warpspace.test.mjs`
- `packages/wesley-cli/test/warpspace.bats`
- `--warpspace` options from `compile-ttd`, `bundle-echo`, `typescript`, and
  `zod`
- WARPspace-backed default file/root resolution from generic CLI commands
- `smol-toml` dependency from `@wesley/cli`

Deleted in the TTD generator package cleanup slice:

- empty `packages/wesley-generator-ttd/` package shell
- package-local TTD Vitest suite that only exercised `@wesley/core/ttd`
- package README and metadata advertising a non-existent `src/index.mjs`
- preserved the remaining CLI `compile-ttd` fixture under
  `packages/wesley-cli/test/fixtures/basic-ttd-protocol.graphql`

Deleted in the TTD generated metadata cleanup slice:

- generated `schema.json`, `ttd-ir.json`, and TypeScript headers no longer
  claim the deleted `@wesley/generator-ttd` package produced them
- that interim `@wesley/core/ttd` metadata surface was superseded by the TTD
  core relocation slice; Continuum-owned output now names
  `continuum/wesley/ttd`

Resolved in the Echo lint-hook cleanup slice:

- fixed indentation-only ESLint failures in `packages/wesley-generator-echo/src/emitRewriteApi.mjs`
  and `packages/wesley-generator-echo/src/index.mjs`
- removed the tracked bad-code note after the exact blocker lint command passed

Resolved in the Echo golden fixture cleanup slice:

- updated `packages/wesley-generator-echo/test/fixtures/basic-v2.ir.json` and
  `packages/wesley-generator-echo/test/fixtures/joins-v2.ir.json` to include
  explicit `footprint: null` on operations without footprint directives
- removed the tracked bad-code note after the full Echo package test passed

Deleted in the TTD/Echo public CLI command cleanup slice:

- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/test/compile-ttd.bats`
- `packages/wesley-cli/test/bundle-echo.bats`
- root `test/cli-composition.bats` cases that invoked `compile-ttd`
- command-only `packages/wesley-cli/test/fixtures/basic-ttd-protocol.graphql`
- `packages/wesley-cli/src/commands/index.mjs` exports for the removed
  commands

The matching extraction-map rows now mark TTD/Echo public CLI commands and
legacy Continuum Bats coverage as done.

Deleted in the CLI Echo dependency cleanup slice:

- `packages/wesley-cli/package.json` no longer declares
  `@wesley/generator-echo`
- `pnpm-lock.yaml` no longer links `@wesley/generator-echo` into the
  `packages/wesley-cli` importer

Deleted in the Echo generator package cleanup slice:

- `packages/wesley-generator-echo/`
- `@wesley/generator-echo` progress metadata
- the package-local Echo IR, codec, golden vector, and plugin adapter tests
- the now-superseded bad-code note for the package's host-node dependency audit

The matching extraction-map row now marks Continuum generator packages as done.
Any future Echo or TTD generator belongs in a Continuum-owned module/repo.

Moved in the TTD core relocation slice:

- `packages/wesley-core/src/ttd/` moved to `continuum/wesley/ttd/`
- `@wesley/core` no longer exports `./ttd` or `./ttd/invariants`
- Continuum's `warp-ttd` compile target now imports the Continuum-owned TTD
  compiler
- generic Wesley kept `@wes_join` validation under
  `packages/wesley-core/src/domain/joinDirective.mjs`

The matching extraction-map row now marks the TTD core package surface as done.

Moved in the schema ownership split:

- Wesley-local `schemas/ttd-protocol.graphql` was retired in favor of
  `warp-ttd`'s canonical `schemas/warp-ttd-protocol.graphql`
- Wesley-local `schemas/echo-core-types.graphql` and
  `schemas/echo-wasm-abi.graphql` were removed; Echo tracks reconciliation in
  `docs/method/backlog/inbox/PLATFORM_reconcile-relocated-wesley-echo-schemas.md`
  instead of treating stale relocated SDL as active schema truth
- Wesley-local `schemas/continuum-receipt-family.graphql` and
  `schemas/continuum-settlement-family.graphql` were removed because
  Continuum owns those authored families
- Wesley-local `schemas/ttd-ir.schema.json` moved beside the Continuum-owned
  TTD compiler at `continuum/wesley/ttd/schemas/ttd-ir.schema.json`

The matching extraction-map rows now mark the product schema ownership split as
done.

Moved in the mixed directive schema cleanup slice:

- Wesley-local `schemas/directives.graphql` no longer declares the TTD-only
  directive family
- the generic composition fixture stopped using `@wes_channel` as a no-op
  transitive import marker
- Continuum owns the relocated TTD directive SDL at
  `continuum/wesley/ttd/schemas/ttd-directives.graphql`

The matching extraction-map row now marks the mixed directive schema split as
done.

Moved in the Supabase generator package cleanup slice:

- `packages/wesley-generator-supabase/` was removed from Wesley;
  `wesley-postgres` owns the package copy
- removed the package-local GitHub workflow, CODEOWNERS entry, package test
  harness, progress metadata, workspace dependency edges, and lockfile importer
- generic runtime/host code now routes legacy Postgres emit through the
  remaining core Postgres generators; those leaks stay tracked by the
  core-export and host/runtime rows

The matching extraction-map row now marks the Supabase generator package as
done while leaving core Postgres exports and host/runtime database coupling
active.

Moved in the Supabase/Next stack package cleanup slice:

- `packages/wesley-stack-supabase-nextjs/` was removed from Wesley;
  `wesley-postgres` owns the package copy
- removed the CODEOWNERS entry, architecture boundary required-package entry,
  progress metadata, and lockfile importer

The matching extraction-map row now marks the Supabase/Next stack package as
done. Remaining database residue lives in the core-export, host/runtime
coupling, fixture/smoke, and root parser dependency rows.

Moved in the PostgreSQL/QIR core and harness relocation slice:

- PostgreSQL-family core exports, implementations, and tests were removed from
  `packages/wesley-core/`
- SQL/test/diff ports, advisory lock helpers, transaction helpers, PostgreSQL
  sanitizers, and database safety validation moved to `@wesley/postgres-core`
- database CLI commands (`plan`, `rehearse`, `up`, `generate-ops`,
  `qir-validate`, and the old BLADE database command) were removed from
  `@wesley/cli`
- Node database adapters and Postgres generator adapters were removed from
  generic host/runtime packages
- root Postgres Docker compose files, smoke scripts, QIR schemas/specs/guides,
  ops fixtures, pgTAP examples, and database E2E harness files were removed
  from Wesley
- active Postgres/QIR/Supabase backlog notes moved to `wesley-postgres`
- `@supabase/pg-parser` was removed from Wesley package metadata and lockfiles

The matching extraction-map rows now mark PostgreSQL-family core exports,
PostgreSQL/Supabase host/runtime coupling, PostgreSQL fixtures and smoke
scripts, the root PostgreSQL parser dependency, and active product/database
backlog/docs as done. The later Holmes counterfactual provider capability slice
also removed the separate non-database product provider row from generic
Holmes.

Moved in the PostgreSQL lock-aware execution slice:

- `packages/wesley-slaps/` moved to `wesley-postgres` as
  `packages/wesley-postgres-slaps/`
- generic `createNodeRuntime.mjs` no longer tries to import `@wesley/slaps`
- removed the package workflow, CODEOWNERS entry, README package matrix row, and
  active docs that described SLAPS as a generic Wesley package
- kept `@wesley/tasks` and `TransmutationRunner.buildTaskGraph()` in Wesley as
  generic planning/task graph surfaces

The matching extraction-map row now marks PostgreSQL lock-aware execution as
done. The later Holmes counterfactual provider capability slice also removed
the separate non-database product provider row from generic Holmes.
