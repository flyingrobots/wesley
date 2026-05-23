# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- **Type-family parity projection design**: Named
  `js-sdl-type-family-vs-rust-l1-type-family.v0` as the next fair parity
  projection for schema-extension and non-table GraphQL facts before admitting
  those fixtures to the default sentinel corpus.
- **Type-family parity sentinel**: `pnpm parity:ir` now implements
  `js-sdl-type-family-vs-rust-l1-type-family.v0`, lets fixtures declare their
  owning projection, and admits `schema-extensions-schema.graphql` to the
  default corpus only under that projection.
- **Rust IR fixture contract note**: Moved the core-rs IR contract and fixture
  backlog card into the active `0013` design packet, naming the v0.0.6 fixture
  classes, canonical byte rules, diagnostics contract, and repo evidence.
- **Domain-empty core boundary packet**: Pulled the boundary card into design
  packet `0014`, defining what generic Wesley owns, what external modules or
  sibling repos own, and the first docs/dispatch audit that keeps product and
  database semantics outside the base compiler surface.
- **Rust IR parity sentinel packet**: Pulled the parity sentinel backlog item
  into design packet `0013`, defining comparator inputs, normalization, hash
  behavior, and failure output for the next JS/Rust parity check.
- **JS/Rust table parity sentinel**: Added `pnpm parity:ir` and the
  `js-table-vs-rust-table.v0` projection so Wesley can compare legacy JS table
  IR with Rust L1 over an explicit table-compatible corpus before broadening
  parity coverage.
- **Expanded Rust L1 fixture corpus**: Added directive-heavy,
  schema-extension, legacy-alias, and invalid duplicate-directive fixtures for
  the v0.0.6 compiler-truth lane.

### Changed

- **v0.0.6 bearing reset**: Reframed `docs/BEARING.md` around Rust IR parity,
  module-boundary enforcement, and explicit `wesley-postgres` preservation
  after the v0.0.5 clean-house release.
- **v0.0.5 release evidence**: Replaced pending publication wording with the
  actual GitHub Release, signed tag, workflow, and crates.io visibility
  evidence.

### Fixed

- **Formatter gate ownership**: `pnpm run format:check` now uses the
  workspace-pinned Prettier binary against the repo-owned formatter surface,
  while leaving Wesley SDL compiler inputs and Rust IR golden bytes under
  parser/generator control.
- **Rust invalid-SDL diagnostics**: `WesleyError` now exposes a stable
  diagnostic object with machine-readable codes, severity, and parser
  line/column spans where Apollo provides a byte index; semantic lowering
  errors keep stable codes while source spans remain intentionally absent.
- **Module target alias collision order**: `wesley compile` now rejects a
  module target name that conflicts with an alias registered by an earlier
  loaded module, closing an order-dependent gap in module-owned target
  dispatch.
- **Parity sentinel evidence contract**: `pnpm parity:ir --json` now records
  canonical projected legacy and Rust bytes, and Rust L1 hash checks remove
  top-level metadata before comparing against `wesley schema hash` or tracked
  `*.l1.hash` outputs.
- **Parity projection ordering**: The `js-table-vs-rust-table.v0` projection now
  sorts table names with deterministic code-point ordering instead of
  locale-aware collation.
- **Parity custom fixture sidecars**: `pnpm parity:ir --fixture` now skips
  tracked `*.l1.hash` checks for non-`.graphql` custom SDL paths instead of
  reading the schema file as its own hash sidecar.
- **Multi-projection parity output**: `pnpm parity:ir` failure output now names
  the projection for each failing fixture and summarizes multi-projection runs
  without implying a single global comparison shape.
- **Type-family repeated directives**: The JS side of
  `js-sdl-type-family-vs-rust-l1-type-family.v0` now preserves repeated
  directive values as arrays instead of overwriting earlier occurrences.
- **Rust directive alias normalization**: Rust L1 lowering now canonicalizes
  the current core Wesley directive aliases to `wes_*` names and rejects
  duplicate canonical directives instead of allowing last-write-wins drift,
  while repeated custom directives are preserved as ordered values.

## [0.0.5] - 2026-05-21

### Fixed

- **Object extension folding validation**: JS GraphQL lowering now rejects
  duplicate fields and repeated Wesley directives when `extend type` blocks are
  folded into base object definitions.
- **L1 fixture regeneration**: `pnpm fixtures:ir` now regenerates the tracked
  Rust L1 `*.l1.json` and `*.l1.hash` corpus through the native Wesley CLI and
  exits nonzero when any fixture fails.
- **Parity sentinel backlog truth**: Clarified that Rust L1 fixture
  regeneration is not the same as the future JS/Rust parity comparator.
- **Progress surface cleanup**: Removed `@wesley/scaffold-multitenant` from the
  active README/progress metadata and architecture-boundary required package
  checks, and replaced the generated overall status hard break with a Markdown
  table.
- **Release dependency audit**: Added pnpm overrides for patched `fast-uri`,
  `brace-expansion`, and `ws` transitive versions so `pnpm audit --prod=false`
  reports no known vulnerabilities during release prep.

## [0.0.4] - 2026-05-15

### Added

- **Runtime optic requirements artifact**: `compile_runtime_optic()` now emits a
  Wesley-owned `OpticAdmissionRequirementsArtifact` containing canonical
  requirements bytes, an explicit `wesley.requirements.canonical-json.v0` codec,
  and a digest computed from those exact bytes. Downstream runtimes can import
  the bytes, digest, and codec directly without reserializing
  `OpticAdmissionRequirements` to create admission truth.

## [0.0.3] - 2026-05-14

### Added

- **Stack Witness 0001 fixture artifact shape**: Added a hermetic
  jedit-through-Echo file-history fixture with operation ids, temporary fixture
  vars bytes, declared footprints, EINT and QueryView helper shapes, fixture
  vectors, and Rust/TypeScript operation binding coverage. The semicolon-kv
  bytes are explicitly marked as fixture-only, while `targetCodec:
wesley-binary/v0` records the future Wesley-generated binary codec target
  without implementing it.
- **Runtime optic root argument validation**: `compile_runtime_optic()` now
  validates selected root field arguments against the schema, preserves
  canonical root argument bindings in `OpticOperation`, and includes those
  bindings in stable operation identity.
- **Runtime optic selected field arguments**: `compile_runtime_optic()` now
  validates selected payload field arguments against the schema, preserves
  canonical field argument bindings in `OpticOperation`, and includes those
  bindings in stable operation and artifact identity.
- **Runtime optic footprint bounds**: `compile_runtime_optic()` now requires
  `reads` and `writes` arrays whenever `@wes_footprint` is present, while
  omitted `forbids` still defaults to an empty forbidden-resource list.
- **Runtime optic root footprint admission**: `@wes_footprint` is now legal only
  on the selected root field for runtime optic artifacts, keeping nested
  directives from changing admission-facing requirements.
- **Runtime optic input literal validation**: `compile_runtime_optic()` now
  recursively validates input object literals, required nested input fields, and
  enum values before emitting `shape.valid.v1`.
- **Runtime optic fragment compatibility**: Runtime optic lowering now rejects
  impossible fragment spreads and inline fragments by comparing parent and type
  condition possible runtime types.
- **Runtime optic nested list validation**: Runtime optic argument literal
  validation now preserves nested list wrappers while descending list values, so
  flattened literals cannot satisfy nested list types.
- **Runtime optic nested list variable compatibility**: Runtime optic variable
  validation now rejects nullable nested-list leaf types when the schema
  argument requires non-null leaves.
- **Runtime optic subselection validation**: Runtime optic lowering now rejects
  composite fields without subselections and leaf fields with subselections
  before emitting `shape.valid.v1`.
- **Runtime optic response-name validation**: Runtime optic lowering now rejects
  conflicting same-response-name selections before payload codec extraction can
  collapse incompatible fields.
- **Optic registry resolver errors**: Removed the unreachable
  `ArtifactIdMismatch` resolver error from the v0 in-memory registry, where
  descriptor artifact ids are lookup keys and unknown ids correctly resolve as
  `ArtifactNotFound`.
- **Runtime optic footprint label validation**: Runtime optic lowering now
  rejects duplicate labels within each `@wes_footprint` `reads`, `writes`, and
  `forbids` array.
- **Runtime optic directive argument validation**: Runtime optic lowering now
  rejects duplicate executable directive arguments instead of preserving
  last-write-wins metadata for law and footprint directives.
- **Runtime optic executable subset guards**: Runtime optic lowering now rejects
  variable defaults, `__typename` selections, and interface inheritance as
  explicit v0 unsupported features instead of accepting them under
  `shape.valid.v1`.
- **Authority and witness wire snapshots**: Runtime optic tests now snapshot
  `CapabilityGrant`, `CapabilityPresentation`, `AdmissionTicket`,
  `LawWitness`, observer classes, permission actions, evidence kinds, and law
  verdict enum spellings.
- **Runtime optic invalid-operation assertions**: Runtime optic regression tests
  now assert structured operation lowering errors instead of matching error
  message substrings.
- **Runtime optic directive preservation**: Runtime optic artifacts now preserve
  directive records from the executable operation, nested selections, fragment
  spreads, fragment definitions, and inline fragments instead of only the root
  field.
- **Runtime optic payload aliases**: Payload codec shapes now use GraphQL
  response names, so aliases and repeated schema fields with distinct aliases are
  reflected in payload paths and artifact hashes.
- **Runtime optic payload requiredness**: Payload codec fields now respect
  nullable ancestors, preventing non-null children under nullable parents from
  being emitted as required response paths.
- **Runtime optic executable directive variables**: Runtime optic directive
  records now preserve variable-backed executable directive arguments, such as
  `@include(if: $flag)`, as canonical variable-reference JSON.
- **Optic artifact registry normalization**: The in-memory optic artifact
  registry now derives stored registration descriptors from artifact identity
  fields instead of trusting stale embedded descriptor data.
- **Optic registration descriptor integrity coverage**: The in-memory registry
  tests now assert operation id tampering is rejected alongside artifact hash,
  schema id, requirements digest, and missing artifact checks.

## [0.0.2] - 2026-05-09

### Fixed

- **Crates.io release clean-worktree recovery**: The release workflow now keeps
  GitHub Release scratch files in the runner temp directory so draft release
  preparation no longer dirties the checkout before `cargo xtask
publish-crates` enforces the real-publish clean-worktree guard.

## [0.0.1] - 2026-05-09

### Added

- **Crates.io alpha publishing metadata**: Prepared the Rust-native crates for
  a first `0.0.1` alpha publication: `wesley-core`,
  `wesley-emit-rust`, `wesley-emit-typescript`, and `wesley-cli`. The
  installable package is `wesley-cli`, which provides the `wesley` binary,
  because the bare `wesley` crate name is already occupied on crates.io.
- **Resilient crates.io alpha publish automation**: Added
  `cargo xtask publish-alpha`, which plans the alpha publish by default and can
  publish with `--execute` in dependency order while using `ninelives` retry
  policy to wait for crates.io index propagation between dependent crates.
- **Official GitHub Actions Rust release procedure**: Documented Wesley's
  tag-driven crates.io release policy and added release guards for version-tag
  alignment, tag-on-main validation, required crate package files, changelog
  coverage, version-linked backlog, dry-runs, and GitHub Actions-only
  publication.
- **Release package sanity and resumable publish flow**: Added strict official
  publish dry-run reporting, package file-set verification for every published
  crate, and idempotent publish execution that skips crate versions already
  visible in the crates.io index.
- **Release workflow publication ordering**: The crates.io release workflow now
  creates or reuses a draft GitHub Release before the first registry mutation,
  finalizes it only after crates.io visibility is verified, and treats open
  issues tied to the release by text, milestone, or label as blockers.
- **Release guard split and SemVer validation**: Added a pre-tag release prep
  guard for manifest, changelog, backlog, and package checks, retained the
  tag-specific release guard for GitHub Actions, and replaced the permissive
  hand-rolled version check with Rust SemVer parsing.
- **Native Rust schema and operation commands**: Added Rust-backed
  `wesley schema lower`, `wesley schema hash`,
  `wesley operation selections`, and `wesley operation directive-args`
  commands. The native CLI now exposes the `wesley-core` L1 lowering,
  registry-hash, operation-selection, and directive-argument primitives without
  going through the legacy Node entry point.
- **Rust-native docs check**: Added `cargo xtask docs-check` for markdown link
  validation, docs-truth manifest validation, and forbidden machine-local path
  detection. `cargo xtask preflight` now runs those checks before Rust tests and
  native CLI help.
- **Legacy Node migration map**: Added a command and package disposition map for
  retiring the historical Node CLI, generators, hosts, runtime packages, and
  evidence tooling on the path to a pure Rust Wesley.
- **Native schema diff**: Added Rust `SchemaDelta` extraction over L1 IR and
  exposed it as `wesley schema diff --old <path> --new <path>` with text, JSON,
  summary, breaking-only, and breaking-change exit-code modes.
- **Git-aware schema diff**: Added `wesley schema diff --schema <path>
--against <rev>` and `--base <rev>` so local edits can be compared against a
  schema's previous Git state without manually materializing an old file.
- **Native schema operation catalog**: Added `SchemaOperation` extraction from
  schema root `Query`, `Mutation`, and `Subscription` fields, preserving root
  arguments, result types, and generic directive JSON. Exposed it as
  `wesley schema operations --schema <path> --json` and covered it with a full
  jedit hot text runtime fixture.
- **Native operation binding emission**: Added Rust and TypeScript operation
  binding projection from `SchemaOperation` data. `wesley emit rust` now emits
  request structs, response aliases, and preserved directive metadata constants
  for root operations; `wesley emit typescript` now emits request interfaces,
  response aliases, operation metadata constants, and operation type aliases.
- **Native TypeScript emitter**: Added `crates/wesley-emit-typescript`, a
  structured TypeScript declaration AST/printer projection from Wesley L1 IR,
  and exposed it as `wesley emit typescript --schema <path> --out <path>`.
- **Native Rust emitter**: Added `crates/wesley-emit-rust`, a structured Rust
  item/type AST printer from Wesley L1 IR, plus `wesley emit rust --schema
<path> --out <path>` and a jedit-shaped hot text model fixture.

- **Holmes counterfactual provider capability seam**: Added
  `holmes.counterfactualProviders` to Wesley module capabilities, moved shared
  Node module-entry loading into `@wesley/runtime-node`, and taught
  `@wesley/holmes` to
  dispatch counterfactual analysis through loaded module providers. Generic
  Holmes now emits a typed unsupported report when no provider module is loaded.
- **pgTAP smoke tests for emitted ops** (#416): Three pgTAP test files replacing
  the skeleton `ops.pgtap.sql` — `ops-parameterless-view` (view + zero-arg
  function), `ops-parameterized-fn` (ILIKE filter with text param), and
  `ops-nested-lateral` (LATERAL join with nested jsonb arrays). CI seed data
  expanded with deterministic UUIDs (user, order, order items). CI workflow
  updated to apply `*.view.sql` alongside `*.fn.sql` and run all `*.pgtap.sql`
  files. EXPLAIN snapshots now cover all 4 ops. TAP output is now parsed for
  assertion failures so CI exits non-zero on test regressions. Negative-case
  and shape assertions added per CodeRabbit review feedback. CI seed step now
  reads `test/fixtures/postgres/03-seed.sql` directly instead of inlining a copy.
- **`graphql` dependency for `@wesley/cli`**: Added `graphql` as a direct
  dependency of `@wesley/cli` so that `.graphql` ops compilation works under
  pnpm's strict module resolution. Previously the dynamic `import('graphql')`
  in `generate.mjs` relied on transitive resolution through `@wesley/core`,
  which pnpm disallows.
- **QIR Dialect Abstraction** (`@wesley/core`): Introduced `SqlDialect` abstract
  interface and `PostgresDialect` implementation that extracts all
  PostgreSQL-specific rendering (jsonb functions, `@>` containment, `ILIKE`,
  `= ANY()`, `CREATE VIEW`/`CREATE FUNCTION` DDL) from `lowerToSQL.mjs` and
  `emit.mjs` into a pluggable dialect layer. Both modules now accept an optional
  `opts.dialect` parameter (defaulting to `PostgresDialect`) — existing behaviour
  is identical. This creates the seam for future MySQL/SQLite/CockroachDB
  backends without touching the dialect-neutral QIR core.
- **QirPlugin** (`@wesley/core`): `GeneratorPlugin` wrapper for the QIR ops
  pipeline. Wraps translate → lower → emit as a first-class transmutation
  participant with per-op evidence tracking. Passes `validatePlugin` contract
  and supports configurable dialect, schema, security, and search_path options.
- **CLI `.graphql` ops support**: `wesley generate --ops` now discovers and
  compiles `.graphql` operation files alongside `.op.json` files. GraphQL
  operations are translated via `TranslateEnv` + `translateOperation` into QIR
  plans and emitted as SQL views/functions. New `--ops-target` flag selects
  `postgres` (default) or `supabase` for auth variable compilation.
- **Example `.graphql` ops**: `example/ops/orders_by_user.graphql` (parameterized
  with nested items) and `example/ops/all_products.graphql` (parameterless).
- **QIR Translator** (`@wesley/core`): GraphQL operation documents → QIR query
  plans. `translateOperation(gql, env, options)` parses a GraphQL operation
  string and compiles it into a `QueryPlan` using the Wesley IR for schema
  introspection. Supports scalar projection, belongsTo (many:1) via LEFT JOIN
  with `JsonBuildObject`, hasMany (1:N) via LATERAL + `JsonAgg`, WHERE filters
  (eq/ne/lt/lte/gt/gte/ilike/isNull/isNotNull, AND/OR/NOT, EXISTS via
  some/none), ORDER BY, LIMIT/OFFSET, and auth variable compilation per target
  platform (Supabase `auth.uid()` vs vanilla PostgreSQL `current_setting`).
- **`TranslateEnv`** (`@wesley/core`): Schema introspection layer that wraps
  the Wesley IR and provides query-time lookups — `resolveTable`, `resolveColumn`
  (with GQL→PG type mapping), `resolveRelation` (belongsTo/hasMany detection via
  FK directives and naming heuristics), `pkField`, `rlsEnabled`, `tenantField`,
  and deterministic alias generation.

- **Master Roadmap (`ROADMAP.md`)**: Consolidated strategic roadmap that now
  acts as the single in-repo roadmap of record, with active backlog and
  execution tracking moved to GitHub Issues and Milestones. Maps the V2 phase
  model to workstreams, defines Alpha blockers, critical path (5 phases), and
  Go Public gate checklist. Includes progress snapshot from
  `meta/progress.json`, deferred/speculative items with provenance tags,
  completed milestone archive, and artifact map for planning documents.

### Changed

- **Rust core operation analysis boundary**: Replaced generic Wesley footprint
  checking APIs with operation selection resolution and directive argument
  extraction primitives. Echo-specific footprint honesty now belongs to
  Echo-owned tooling rather than the Wesley core API.

### Removed

- **Native `check-footprint` command**: Removed the root `wesley check-footprint`
  CLI surface and its JSON contract from the Wesley binary.

### Fixed

- **Git identity release guard**: Added collaborator-neutral preflight and Rust
  release guard checks that reject known fixture identities in repo-local Git
  config and the release `HEAD` author/committer metadata before publish prep
  can proceed.
- **Nested GraphQL list lowering and emission**: L1 type references now retain
  nested list wrapper depth, and the Rust and TypeScript emitters project nested
  GraphQL lists as nested vectors/arrays instead of flattening to one level.
- **Schema diff field arguments**: Schema delta now compares object and interface
  field arguments, including additions, removals, type changes, default changes,
  and directive changes, so required argument additions are reported as breaking.
- **Operation binding symbol collisions**: Rust and TypeScript operation
  emitters now include the root operation scope in generated request, response,
  metadata, and operation binding symbols so schemas can reuse field names
  across `Query`, `Mutation`, and `Subscription` without duplicate generated
  declarations.
- **PR readiness checks**: Fixed PR feedback failures by removing an unused
  fixture-generation import, replacing the CI-breaking docs link to a sibling
  checkout with repo-local wording, making the legacy CLI package test glob
  compatible with Node 20 runners, and preparing a passing SHIPME certificate
  fixture before the certificate workflow verifies it.
- **Docs link preflight and Rust package dry-runs**: The legacy Node docs link
  checker now ignores Rust `target/` build artifacts, matching the Rust-native
  docs check and preventing `cargo publish --dry-run` package trees from
  breaking later preflight runs.
- **Release documentation polish**: Crate README links now resolve from packaged
  crates, the release install example uses a version placeholder, and committed
  trailing whitespace from the release branch diff was removed.
- **Module runtime review hardening**: Isolated CLI command registration per
  invocation, rejected duplicate module command and compile-target names,
  preserved `file://` module specifiers in env parsing, failed loudly for
  missing explicit `WESLEY_CONFIG` paths, ignored disabled modules during module
  allowlist checks, froze normalized capability registry data, and made the
  front-door CLI docs guard hermetic.
- **Release dependency audit posture**: Added targeted pnpm overrides for
  vulnerable `brace-expansion`, `picomatch`, and `postcss` lockfile paths, and
  updated the root PostCSS range so `pnpm audit --json` reports zero
  vulnerabilities for the current workspace dependency graph.
- **Front-door CLI documentation drift**: Replaced the non-existent
  `pnpm wesley holmes dashboard` guide example with the real HOLMES package
  report command plus the static dashboard artifact path, and added a preflight
  guard that verifies `README.md` and `docs/GUIDE.md` only document registered
  `pnpm wesley <command>` examples.
- **Module-loading trust controls**: Added `WESLEY_DISABLE_MODULES=1` for
  no-module diagnostic runs and `WESLEY_MODULE_ALLOWLIST` for CI/client
  environments that must reject unapproved `wesley.config.mjs` and module
  imports before trusted Node extension code executes.
- **CodeRabbit PR review scope**: Added repo-owned CodeRabbit auto-review
  configuration so non-draft pull requests targeting any base branch are
  reviewed, not only PRs targeting the repository default branch.
- **Stale pre-commit realization guard**: Removed the package-manifest commit
  hook call and GitHub preflight workflow call to the deleted root
  `verify:realization` script. Generic Wesley no longer resurrects the old
  Continuum verifier during commits or PR checks; product-specific realization
  checks belong behind module capabilities.
- **Moriarty counterfactual module discovery**: Programmatic Moriarty prediction
  calls now forward their injected environment into counterfactual provider
  discovery, so `WESLEY_MODULES` and `WESLEY_CONFIG` work outside the CLI
  process environment too.
- **PR #472 Continuum review follow-up**: `witness-continuum` now rejects
  missing canonical Echo schema origins, verifies the Echo IR SDL hash, and
  reports malformed JSONL rows with line context. `bundle-echo` now reports
  malformed `ir.json` content clearly and only falls back to the workspace
  generator when `@wesley/generator-echo` is actually missing. The Continuum
  signposts, backlog packets, and retro verification docs were also tightened
  to fix canonical-path drift, define the public-surface matrix shape, and
  clean up wording inconsistencies raised during PR review.
- **SHIPME PR comment ordering**: The PR badge in
  `.github/workflows/cert-shipme.yml` now waits for the HOLMES suite comment
  for the current PR head SHA, checks the live HOLMES workflow state while
  polling, and fails explicitly if that comment never appears, so reviewers no
  longer see a SHIPME certificate badge race ahead of the current investigation
  summary or disappear silently behind a stale timeout.
- **PR #467 HOLMES comment workflow follow-up**: The PR comment job now checks
  out the repository before building the comment, the `pr-comment-cli` helper
  no longer depends on `commander` so it can run in the lightweight workflow
  job without installing package dependencies, and the comment summary cleanup
  now uses linear whitespace and trailing-period normalization that is pinned by
  direct Holmes comment tests. Successful HOLMES jobs also distinguish missing
  and invalid JSON report artifacts in the plain-English summary instead of
  blaming a `success` workflow status for unreadable reports. The expanded raw
  report sections now tell the same truth about missing markdown artifacts, and
  unavailable Watson or Moriarty reports now add explicit recovery steps to the
  suggested next actions list instead of failing silently.
- **PR #467 Holmes comment test hardening**: The Holmes PR comment regression
  tests now use case-insensitive word-boundary matching to keep unexplained
  score acronyms out of the visible summary, and the missing-report tempdir
  fixture test now has an explicit timeout so the suite fails fast instead of
  hanging on a stuck report loader.
- **PR #467 Holmes comment ownership guard**: The HOLMES PR comment workflow
  now updates only the marker-tagged `github-actions[bot]` comment, and it
  warns instead of overwriting legacy bot comments that merely contain the
  Holmes title text. This prevents the PR comment updater from clobbering
  unrelated bot comments such as CodeRabbit replies.
- **PR #467 Holmes next-action and status follow-up**: The Holmes PR comment
  builder now preserves at least one suggested action from Holmes, Watson, and
  Moriarty before truncating the visible list, so non-Holmes recovery steps do
  not disappear behind a Holmes-heavy action queue. Omitted workflow-status
  flags also no longer masquerade as unknown workflow failures when readable
  Holmes-suite artifacts are already present, and the regression is pinned by
  direct comment-builder tests.
- **PR #467 Holmes workflow and CLI hardening follow-up**: The SHIPME workflow
  now fails explicitly if no matching `wesley-holmes.yml` run appears after a
  bounded poll window and no longer double-filters runs by SHA after the API
  already scoped them. The Holmes PR comment CLI now imports without side
  effects, accepts both `--flag value` and `--flag=value` forms, and the
  shared test fixtures plus loader diagnostics now keep comment-builder tests
  reusable and easier to debug when report artifacts are malformed or
  unreadable.
- **PR #463 cert failure JSON assertions**: The HOLMES failure-path cert E2E
  tests now assert against the first JSON document emitted by `cert-verify
--json`, splitting presence and value checks for `holmesPassed`,
  `holmesVerdict`, `eligibleToShip`, and `reasons`, so missing fields and wrong
  values fail independently while staying robust when the command also emits
  the framework error envelope.
- **PR #463 HOLMES fixture and scoring follow-up**: The cert E2E HOLMES
  fixtures now share one parameterized builder, preserve the weak-evidence and
  strong-evidence profiles used by SHIPME coverage, include representative
  `testResults` payloads, and the scoring tests now pin both sides of index
  coverage semantics with clearer scenario names and an explicit “indexed but
  uncovered” regression.
- **HOLMES workflow schema selection and SHIPME cert fixture**: The HOLMES CI
  workflow now honors `HOLMES_SCHEMA` before falling back to repository-wide
  GraphQL discovery, TCI now treats “no indexed fields” as a fully covered
  performance obligation instead of an automatic miss, and the SHIPME workflow
  now exercises a clean schema fixture that can honestly clear HOLMES before
  certificate verification.
- **HOLMES-backed SHIPME certification**: The certificate workflow now emits a
  real Wesley bundle before running HOLMES, `cert-create` builds HOLMES
  summaries from bundle-embedded scores instead of requiring a separate
  `scores.json`, `cert-verify` reports normalized HOLMES verdicts, and the
  HOLMES workflow jobs now declare the generated bundle/schema dependency
  explicitly.
- **SHIPME PR comment matching**: Hardened the certificate workflow to anchor
  bot comments with a stable HTML marker, paginate comment lookup, and target
  `github-actions[bot]` explicitly before updating an existing PR comment.
- **`@wesley/core` npm lockfile drift**: Regenerated
  `packages/wesley-core/package-lock.json` so the npm lockfile now matches the
  `@supabase/pg-parser` `^0.1.7` dependency declared in `package.json`.
- **Website TipTap content sync**: Removed the unsupported `preserveCursor`
  option from the `RichEditor` `setContent()` call and added a regression test
  so future TipTap bumps do not silently reintroduce the unsupported API usage.

### Removed

- **Built-in Holmes `git-warp` provider**: Removed direct `@git-stunts/*`
  dependencies and `git-warp` provider defaults from `@wesley/holmes`; product
  counterfactual providers now belong in external modules.
- **QIR duck-typing fallbacks (SR-m2)**: Removed 3 duck-typing fallbacks from
  `renderExpr` and 1 from `renderRelation` in `lowerToSQL.mjs`. Objects without
  explicit `kind` tags now throw `Unsupported expr kind` / `Unsupported relation
kind` instead of being silently accepted via structural duck-typing. All
  current callers already use proper `Nodes.mjs` constructors — no behavioral
  change for well-formed input.

### Refactored

- **`guessPrimaryKeyRef`**: Uses `new ColumnRef(alias, 'id')` constructor
  instead of a raw object literal, consistent with the rest of the QIR codebase.

- **`unwrapType`**: extracted from three inline copies in `generator-echo`
  (`index.mjs`, `emitWasmAbiCodec.mjs`, `emitWasmAbiCodecTs.mjs`) into shared
  `src/graphql-utils.mjs` with 7 dedicated tests

### Added

#### WASM ABI Codec Generation

- **`emitWasmAbiCodec`**: Generates `wasm_abi_codec.generated.rs` with deterministic
  binary encode/decode for all Echo WASM FFI response types (`DispatchResponse`,
  `HeadInfo`, `StepResponse`, `ChannelData`, `DrainResponse`, `RegistryInfo`,
  `AbiError`), plus binary envelope helpers (`encode_ok`, `encode_err`,
  `decode_envelope`) — replaces CBOR encoding at the WASM boundary
- **`emitWasmAbiCodecTs`**: Generates matching `wasm_abi_codec.generated.ts` with
  TypeScript encode/decode functions (byte-identical wire format to Rust),
  `AbiResult<T>` discriminated union, `decodeEnvelope` generic decoder, and
  per-response-type convenience envelope decoders
- **`schemas/echo-wasm-abi.graphql`**: Canonical GraphQL schema defining WASM ABI
  response types with custom scalars (`Hash32`, `Bytes`, `U32`, `U64`)
- **Custom ABI scalar wire formats**: `Hash32` encodes as raw 32 bytes (no length
  prefix — fixed-size BLAKE3 hashes), `Bytes` as u32 LE length-prefixed blob,
  `U32`/`U64` as unsigned little-endian integers
- **Envelope wire format**: Success `[0x01][payload...]`, Error
  `[0x00][u32 LE code][u32 LE msg_len][UTF-8 msg...]`
- 53 tests (30 Rust codec, 23 TypeScript codec) covering struct generation, scalar
  encoding, envelope functions, optional/nested/list field handling, schema drift,
  and integration

### Fixed

- **Rust codec `decode_raw_le_at`**: offset parameter now correctly uses `&mut`
  instead of by-value, matching the mutable-offset convention used by all other
  decode helpers
- **`InvalidEnvelopeTag`** error variant added to Rust `AbiError` enum for
  exhaustive envelope tag matching
- **`toSnakeCase`** now correctly handles consecutive capitals (e.g.
  `schemaSha256Hex` → `schema_sha256_hex` instead of `schema_sh_a256_hex`)
- **TS codec**: removed redundant `| undefined` from optional interface
  properties (the `?` modifier already implies `undefined`)
- **TS codec `_encodeOption`**: signature changed from `T | null | undefined` to
  `T | null` for consistency with interface types
- **Shared SDL fixture**: test suites now import from a single canonical
  `test/fixtures/wasm-abi-sdl.mjs` to prevent schema drift between Rust and TS
  codec tests

### Changed

- **`CONTRACT_VERSION`** bumped from `1.1.0` to `1.2.0` — reflects new WASM ABI
  codec artifact files (`wasm_abi_codec.generated.rs`, `wasm_abi_codec.generated.ts`)
- **`EchoPlugin.plan()`** now declares 10 potential artifacts (was 8)

#### Other

- `@wesley/test-fixtures` package with shared test schema builders (`simpleUser`,
  `userWithProfile`, `multiTenant`, `ecommerce`, `allDataTypes`, `empty`,
  `circularForeignKeys`), re-exported `MockDatabase`, `testFixtures`, `dbAssert`,
  and property-testing utilities for cross-package use.
- CLI command auto-discovery in `program.mjs` — new commands are registered
  automatically by dropping a `.mjs` file in `commands/` without editing any
  registration file (fixes Open/Closed principle violation).

### Changed

- `ConcurrentSafetyError`, `BackpressureError`, and `SafetyValidationError` now
  extend `WesleyError` instead of bare `Error`, unifying the error hierarchy
  under a single base class with `code` + `meta` semantics. Backward-compatible:
  `.context` / `.details` properties preserved.

### Removed

- Dead duplicate generators in `wesley-generator-supabase`: `repair.mjs`,
  `trigger.mjs`, `rollback.mjs` (byte-for-byte copies of the canonical files
  in `wesley-core/src/domain/generators/`, never imported or exported).

### Fixed

- `backpressure-controller.test.mjs` and `concurrent-safety-analyzer.test.mjs`
  imported nonexistent underscore-prefixed exports (`_BackpressureActivated`,
  `_ConcurrentAnalysisStarted`, etc.) — corrected to match actual export names.

### Changed

- **License**: Standardized all `package.json` files to `Apache-2.0`, matching
  the project's `LICENSE` file. Removed appended MIND-UCAL text from `LICENSE`.
  Added `NOTICE` file per Apache 2.0 requirements.
- **IR**: `GraphQLAdapter.parseSDL()` now emits the `WesleyIR.schema.ts` shape:
  structured `FieldType` objects (`{ base, isList, listItemNullable }`),
  structured `TableDirectives`/`FieldDirectives`, top-level `version`,
  `metadata`, `enums`, `scalars`, `relationships`, and `table.fields` (not
  `columns`). The backward-compat shim (`table.columns`, `table.primaryKey`,
  `table.foreignKeys`, `table.tenantBy`) has been removed — all consumers
  now use the new shape directly.

### Removed

- **IR**: Backward-compat shim properties (`table.columns`, `table.primaryKey`,
  `table.foreignKeys`, `table.tenantBy`) removed from `GraphQLAdapter`,
  `BrowserParserPort`, and `ir.schema.json`. Legacy helper methods
  (`applyBackwardCompatShim`, `mapGraphQLTypeToPostgreSQL_fromFieldType`,
  `gqlScalarToPostgreSQL`, `flattenFieldDirectives`) deleted.

### Added

- **Transmutations architecture spec**: Design doc at `docs/architecture/transmutations.md`
  covering source-to-generator mappings, per-element evidence tracking, contextual
  HOLMES scoring, and Moriarty dual-layer prediction (Phase 0–6).
- **`WesleyError` base class** (`@wesley/core`): Structured error with `code`, `meta`,
  and optional `cause` (forwarded to native ES2022 `Error.cause` chain).
  `OpsError` and `PluginError` extend it. Replaces ad-hoc `e.code =` patterns.
- **`TransmutationRunner`** (`@wesley/core`): Unified orchestrator merging
  `GenerationPipeline` and `PluginRunner`. Named transmutations, per-element evidence
  collection, evidence merging, and `buildTaskGraph()` DAG descriptor.
- **`irToSchema` in core**: Adapter moved from CLI into `@wesley/core`. CLI re-exports.

- **Exit code registry** (`@wesley/core`): `ExitCodes.mjs` is the single source of
  truth for error-code → exit-code mappings. `exitCodeFor()`, `isRegistered()`,
  and `getRegistry()` exported from `@wesley/core/domain/ExitCodes`. Both
  `WesleyCommand.exitCodeFor()` and the legacy `utils.exitCodeFor()` now delegate
  to the core registry instead of maintaining independent switch/map copies.
- **`validateGenerateResult()` port function** (`@wesley/core`): Extracted inline
  generate-result validation from `PluginRunner` and `TransmutationRunner` into a
  reusable port function in `GeneratorPlugin.mjs`, following the `validatePlan()`
  pattern. Validates both legacy `Record<string, content>` and transmutation-aware
  `{ files, evidence }` shapes, returning a normalized `{ artifacts, evidence }`
  object. WPLY003 errors are thrown consistently via the port.

### Fixed

- **`up.mjs` migration helpers**: Eliminated diverged local copies of
  `buildAdditivePlan`, `explainPlan`, `lockFor`, and `emitMigrations` in favor
  of the shared `_migration-plan.mjs` module. The local copies had silently
  diverged, introducing 4 bugs:
  1. Index dedup ignored USING method — two indexes on the same fields with
     different methods (btree vs gin) were silently skipped.
  2. Falsy default coercion — `lockFor` used truthiness check instead of
     `!= null`, so defaults of `0`, `false`, `''` triggered ACCESS EXCLUSIVE
     instead of SHARE ROW EXCLUSIVE.
  3. NOT NULL / DEFAULT coupling — DEFAULT was only emitted when the column was
     also NOT NULL, and NOT NULL was never emitted at all.
  4. No SQL injection guards — shared module validates `s.type`, `s.using`, and
     `s.default` against safe regexes; local copies had zero validation.
- **`TransmutationRunner`**: Full null-safety at plugin return shape boundaries.
  `files` validated as non-null, non-array object; `evidence` validated as
  non-null, non-array object; evidence entries with missing/invalid `.artifacts`
  silently skipped instead of throwing. All invalid shapes produce structured
  `WPLY003` errors that respect best-effort mode.
- **Ops manifest validation**: `OpsError` wrapping now reads AJV errors from
  `e.meta.errors` (where `assertValid` puts them) instead of `e.errors`.
- **Exit code mappings**: Added 11 missing error codes (`DIRTY_WORKTREE`,
  `CERT_INVALID`, `EEXIST`, `EARGS`, `EUSAGE`, `ERR_MISSING_ARGUMENT`,
  `NO_DSN`, `REALM_FAILED`, `OPS_MANIFEST_INVALID`, `INVALID_TARGET`,
  `TTD_COMPILE_FAILED`) so CLI exits with stable, semantic exit codes.
- **`TransmutationRunner`**: Validate phase correctly labeled `'validate'`
  (was `'init'`). `generateRunId` pads to consistent 6-char suffix.
  `evidenceMap.toJSON()` serialized once. `structuredClone` replaces
  `JSON.parse(JSON.stringify(...))` for config cloning. Plugin evidence
  `errors` and `warnings` forwarded to `EvidenceMap`.
- **`irToSchema`**: Preserves `listItemNullable` → `itemNonNull` on `Field`
  construction (was silently dropped, widening `[T!]` to `[T]`).
- **`assertCleanGit` wrappers**: Removed redundant try/catch in `generate.mjs`
  and `plan.mjs` since `assertCleanGit` now throws `WesleyError` directly.
- **CLI**: Named exports standardized across all 19 command files (removed `export default`).
- **CLI**: Revived `models`, `typescript` (alias `ts`), and `zod` commands,
  wired to existing generators in `@wesley/generator-js`:
  - `wesley models --schema <file> --target ts|js --out-dir <dir>`
  - `wesley typescript --schema <file> [--out-file <file>]`
  - `wesley zod --schema <file> [--out-file <file>]`
- **CLI framework**: `irToSchema` adapter bridging parser IR to core domain
  `Schema`/`Table`/`Field` objects for TypeScript and Zod generators.

### Fixed

- `GeneratorCommand` and `FileOutputGeneratorCommand` constructors now accept
  DI context as first argument, matching `WesleyCommand`.

### Removed

- **host-node**: Removed public `MigrationDiffEngine` export from `index.mjs`.
  The internal stub in `adapters/index.mjs` is unchanged.

### Security

- **S:** Resolved 15 GitHub dependabot alerts (11 high, 4 moderate) — bumped `@playwright/test` 1.49→1.58.2 (SSL cert verification), `dependency-cruiser` 17.1→17.3.8, `ajv` ^8.12→^8.18 in `@wesley/cli` (ReDoS); added pnpm overrides for transitive `minimatch` (ReDoS), `js-yaml` (prototype pollution), `markdown-it` (ReDoS)

### Fixed

- **F:** Per-op `ResultSchema` now wraps list result types with `z.array()` and nullable results with `.optional()` — previously `buildOpsFromSDL` dropped `list`/`required` metadata from result types, causing e.g. `listUsers: [User!]!` to generate `ListUsersResultSchema = UserSchema` instead of `z.array(UserSchema)`
- **F:** Generated `parseViewOps` now throws on trailing garbage bytes (1–7 bytes after the last complete envelope) instead of silently accepting them — critical for deterministic replay and envelope integrity
- **F:** Client/pump integration tests now `eval` the actual generated `parseViewOps`/`createPump` functions instead of reimplementing parsing logic inline, ensuring regressions in generated client behavior are caught
- **F:** `EchoPlugin.plan()` now declares all 8 potential artifacts (was missing conditional Rust/TS codecs, joins, guarded views)
- **F:** `emitOps.mjs` `findOpId(name)` aligned to two-arg `findOpId(kind, name)` matching `emitClient.mjs` — one-arg form could collide when a Query and Mutation share the same field name
- **F:** `evidenceMap.record()` for field source locations moved inside `buildTable` field loop (was misplaced at module scope) — fixes #337
- **F:** `sanitizeGraphQL()` in Node host aligned with browser runtime — BOM and null byte stripping now use identical char-code logic instead of regex with embedded control characters

### Added

#### Utility Helpers

- **A:** `mustFind()` and `mustMatch()` guard helpers in `@wesley/core` — centralise the recurring find-or-throw and match-or-throw pattern

#### Ops DSL

- **A:** `schemas/op.schema.json` — JSON Schema for `*.op.json` ops DSL (filters, joins, lists, params)
- **A:** `packages/wesley-core/src/domain/qir/op.schema.mjs` — ESM companion for runtime Ajv validation, re-exported from `qir/index.mjs`
- **A:** `example/ops/all_products.op.json` — example op fixture
- **A:** `scripts/dev/setup-bats-plugins.sh` — pinned installer for bats test plugins (bats-support, bats-assert, bats-file)

#### Infrastructure

- **A:** Docker Compose fixture + `scripts/smoke/postgres-fixture.sh` for Postgres fixture smoke tests (`pnpm run smoke:postgres-fixture`)

#### WES — Documentation & Compatibility

- **A:** Updated `README.md` for `@wesley/generator-echo` — documents one-pass profile, full artifact list, client/pump API, contract versioning, plugin usage
- **A:** Updated `README.md` for `@wesley/generator-vue` — documents unified `VuePlugin` entrypoint, legacy function API
- **A:** Updated `docs/specs/echo-ir-v2.md` — documents `contract_version` field, type/op ordering rules, version bump policy

#### WES-005 — Unify generator-vue Ownership/Entrypoint

- **A:** `VuePlugin` class implementing `GeneratorPlugin` contract — canonical unified entrypoint
- **A:** Package exports `./plugin` subpath for plugin-based invocation
- **A:** Vue plugin test suite (`vue-plugin.test.mjs`) with 12 tests covering contract, lifecycle, capabilities, and backward compatibility

### Changed

- **C:** `CONTRACT_VERSION` bumped from `1.0.0` to `1.1.0` — reflects `KIND:name` keyed `OP_INDEX` and two-arg `findOpId(kind, name)` in generated artifacts
- **C:** Legacy `generateVue()` function remains available but documented as non-primary path

#### WES-004 — One-Pass App Codegen Profile (schema → IR/Rust/TS)

- **A:** `profile` metadata in `generateEcho()` output describing artifact sets (IR, TS, Rust targets)
- **A:** Types sorted alphabetically in IR for deterministic output independent of SDL declaration order
- **A:** One-pass profile test suite (`one-pass-profile.test.mjs`) with 15 tests covering atomic generation, cross-artifact parity, no-duplicate-transform verification, and performance baseline

#### WES-003 — Artifact Contract Versioning + Deterministic Output Tests

- **A:** `contract_version` (semver) field added to IR, `ops.generated.ts`, and `client.generated.ts` HANDSHAKE
- **A:** Types in IR now sorted alphabetically for ordering stability across SDL variations
- **A:** Contract determinism test suite (`contract-determinism.test.mjs`) with 22 tests covering byte-for-byte stability, ordering, edge cases, and version bump policy
- **A:** Version bump policy codified in tests (major/minor/patch rules)

#### WES-002 — Integration-Ready TS Runtime Client/Pump

- **A:** Complete `emitClient.mjs` rewrite — generates self-contained TypeScript client with typed dispatch/query APIs
- **A:** Canonical pump loop (`createPump`) for view-op envelope parsing and routing
- **A:** `parseViewOps` for binary envelope decoding (u32le op_id + u32le length + payload)
- **A:** `HANDSHAKE` constants exported for registry handshake / integration gates
- **A:** `DiagnosticsChannel` interface for unknown op / decode error surfacing
- **A:** Client/pump test suite (`client-pump.test.mjs`) with 22 tests covering compilation, dispatch, query, pump routing, and edge cases

#### WES-001 — Per-Op Var/Result Schema Wiring

- **A:** `emitSchemas.mjs` now generates `VarsSchema` and `ResultSchema` for every operation in the ops catalog
- **A:** `OP_SCHEMAS` registry map exported for runtime op-to-schema lookup
- **A:** TTD `ts-zod.mjs` now emits per-op result schemas alongside existing args schemas
- **A:** Schema completeness test suite (`schema-completeness.test.mjs`) with 11 tests covering completeness, edge cases, and ordering stability

#### Alpha Playground — Browser-Based "Try Wesley"

- **A:** `/try` route, TryNow page, workspace state, file tree UI, Tiptap-based schema editor with GraphQL highlighting
- **B:** `compileSchemaInBrowser()` API in `@wesley/host-browser` — regex-based parser, in-memory pipeline, SQL migration generation
- **C:** PGLite integration — `DbSession` with `applyMigrations`/`reset`/`query` (100-row limit), `FakeDbSession` for tests, `DatabasePanel` with table view and schema inspector
- **D1.1a:** Centralized error panel for compile, migration, query, and DB init errors
- **D1.1b:** "Reset Playground" with confirmation modal (resets schemas, DB, compile state)
- **D2.1b:** `docs/guides/browser-playground.md` architecture guide
- **D2.2:** CI test step added to `wesley-website.yml` workflow; deploy gated to push-to-main only
- 10 TryNow component tests (incl. individual error dismissal), 5 PGLite integration tests, 4 FakeDbSession regression tests
- Stable error IDs (monotonic counter) for race-free individual error dismissal
- Per-error dismiss for compile errors (no longer resets `lastSuccess`)
- Guard against false "success" when no `migrations.sql` in compiled output
- DDL detection regex uses word boundaries to avoid false triggers
- `PlaygroundNavbar` handleSelect fallback to no-op prevents TypeError
- Fixed `PlaygroundNavbar` crash when tutorial props are absent
- `wesley-website` bumped to v0.1.0
- ROADMAP-ALPHA.md marked 343/343 complete (100%)

#### E0 — Plugin Pipeline Stabilization

- **E0.1:** `GeneratorPlugin` contract with `apiVersion`, error isolation (WPLY001–004), `--best-effort` mode, per-plugin status summary, `PluginRunner` orchestrator with frozen context
- **E0.1:** `ArtifactWriter` with overwrite detection, conflict reporting, atomic writes via temp staging, dry-run support
- **E0.2:** Plugin discovery and registration via `wesley.config.mjs` `generators` array (`package`, `config`, `enabled` fields)
- **E0.2:** `ConfigValidator` with `experimental` flag support (`irV2`, `rawLe`, `join`) and unknown-flag warnings
- **E0.3:** `testGenerator(plugin, sdl, config?)` test harness with `testGeneratorPlan()` and `expectArtifact()` assertion helpers
- **E0.4:** Generator plugin authoring guide (`docs/guides/generator-plugins.md`)
- **E0.5:** `wesley doctor` CLI command — checks Node version, config, plugins, crypto, experimental flags; `--format json`

#### E1 — Boundary Grammar & Schema Hash Pinning

- **E1.1:** `canonicalize(sdl)` — deterministic AST serialization with lexicographic sorting, `extend type` folding, NFC normalization
- **E1.2:** `schemaHash(sdl)` — SHA-256 of canonical AST bytes, 64-char lowercase hex
- **E1.3:** `registryHash(obj)` and `canonicalizeJSON(obj)` — deterministic registry blob hashing
- **E1.4:** `computeHashChain()` — full provenance: `sdl_hash → schema_hash → ir_hash → registry_hash → bundle_hash`
- **E1.5:** `echo-ir/v2` format — `schema_hash`, `registry_hash`, `hash_chain`, per-type `type_id`/`layout_hash`, per-field `join`
- **E1.6:** `computeDelta(oldSDL, newSDL)` — machine-readable schema diff with breaking change detection
- **E1.7:** `wesley diff` CLI — `--format text|json|summary`, `--breaking-only`, `--exit-code`

#### E2a — Canonical Encodings

- **E2a.1:** `emitRawLeCodec` — generates `raw_le_codec.generated.rs` with per-type `encode_raw_le`/`decode_raw_le`, `DecodeError` enum, alphabetical field order, LE numerics, NaN canonicalization (`0x7FC00000`), `Option<T>` prefix tags, length-prefixed strings
- **E2a.2:** `emitRawLeTsCodec` — generates `raw_le_codec.generated.ts` with browser-safe `DataView`/`Uint8Array` encode/decode, byte-identical to Rust, TypeScript interfaces for all types
- **E2a.3:** `computeLayoutHash(type, typeIndex)` — stable per-type layout descriptor → SHA-256, integrated into `echo-ir/v2` as `layout_hash` per type

#### E2b — Core Type Schemas

- **E2b.1:** Echo core storage types in Wesley SDL (`schemas/echo-core-types.graphql`): `WorldlineTickPatchV1`, `SnapshotManifest`, `ClaimRecord`, `PrivateAtomRefV1`, `OpaqueRefV1`, `FieldPatch`

#### E2c — Guarded Views

- **E2c.1:** `emitGuardedViews` — generates `guarded_views.generated.rs` with per-rule `ReadView`/`WriteView` structs from `@wes_view` directive, `from_full` and `apply_write` methods

#### E2d — Cross-Platform Determinism

- **E2d.1:** Golden vector test suite — 44 checked-in JSON vectors across 12 fixture files (Boolean, Int, Float, String, ID, List, Option, Enum, nested objects, multi-field, optional list, privacy types) with reference encoder harness

#### E3 — @wes_join Directive

- **E3.1:** `@wes_join(strategy: "union"|"max"|"lww")` directive parsing and validation
- **E3.2:** Rust `JoinFn` trait codegen — `emitJoinImpls()` generates `impl JoinFn` with per-field lattice calls, `has_join` per-type IR metadata
- **E3.3:** Join directive documentation (`docs/guides/wes-join-directive.md`)

#### E4 — Privacy Types

- **E4.1:** Privacy type canonical encoding verification — 28 tests for `ClaimRecord`, `PrivateAtomRefV1`, `OpaqueRefV1` round-trip encoding, Rust codegen field order, optional field handling

#### Previous (pre-Echo roadmap)

- Generators: `@wesley/generator-vue` minimal TS type emission (enums + interfaces)
- Generators: hardened `@wesley/generator-echo` with explicit SDL validation and package README
- Generators: ops helpers tests (`ops.generated.ts`) for ops-catalog wiring
- Core (QIR): `lowerToSQL` for SELECT/JOIN/LATERAL/ORDER BY/LIMIT/OFFSET
- Core (QIR): `emitView` and `emitFunction` (RETURNS SETOF jsonb)
- Tests: unit + snapshot tests for lowering and emission
- Docs: `docs/guides/qir-ops.md`; PR template and CODEOWNERS
- CI: Ubuntu-only CLI matrix; stabilized architecture-boundaries workflow

### Changed

#### PR Self-Review (qir/phase-c)

- **Cursor encoding**: Use `charCodeAt()` instead of `codePointAt()` for Latin1 binary string decoding (atob output is always 0-255)
- **Lock-level readability**: Break dense `add_column` lock ternary into named boolean (`canAvoidRewrite`) with multi-line conditional; also fixes `step.default` truthy check (`0`/`''` are valid defaults)
- **ESLint flat config**: Migrate from legacy `.eslintrc.json` to `eslint.config.js` for ESLint 9 compatibility; install missing `eslint-plugin-promise`; fix all 612 pre-existing lint errors across the codebase
- **Pre-commit hook**: Add lint enforcement guard to `.githooks/pre-commit` (skippable via `WESLEY_SKIP_LINT_HOOK=1`)

#### Other

- `generator-echo` now emits `echo-ir/v2` (was `echo-ir/v1`)
- `schema_sha256` in IR uses canonical AST hash (was raw SDL hash)
- **CR-13/14/20/21:** `docs/guides/qir-ops.md` — remove stale "Discovery Modes (planned)" section, add `version` field to registry example, update shipped features to present tense, prune shipped roadmap bullets
- **CR-32:** `docs/spec/ir-family-spec.md` — replace `\n` with `<br/>` in Mermaid node labels so line breaks render correctly
- **CR-17:** `docs/spec/ir-family.md` — add `## ` heading markers to Cross-references, Versioning, Validation, and Envelope sections
- **CR-18:** `docs/spec/qir.md` — insert blank lines after all `##` headings for consistent markdown formatting
- **CR-19:** `docs/spec/qir.md` — add `distinctOn?` field to QueryPlan Top Level section
- **CR-28:** Add cross-reference blockquotes linking `ir-family.md` and `ir-family-spec.md`
- **CR-29:** `docs/README.md` — add IR Family Overview, IR Family Specification, and QIR Specification links under Core Concepts

### Fixed

#### PR Self-Review (qir/phase-c)

- **Double JSON output**: Commands that write their own JSON (cert-verify, cert-create, plan, rehearse, up) no longer trigger the framework's duplicate JSON wrapper, fixing `jq` pipeline breakage and cert-e2e test failures
- **SHIPME.md marker ordering**: `extractJsonBlock()` now throws a descriptive error instead of returning null when certificate markers are present but out of order
- **SQL comment injection**: `emitMigrations()` quotes table names in SQL comments using the same `q()` function used for all other identifiers
- **Param index lookup**: `lowerToSQL` uses nullish coalescing (`??`) instead of `||` for parameter index lookups, preventing index `0` from being swallowed
- **Missing imports**: Fixed `CompilerError` import in inprocess-compiler, `ev1` typo in compiler-inprocess, removed unreachable code in GraphQLAdapter

#### QIR Phase C — Self-Code Review (PR #392)

- **C1:** `Predicate.isNull()`/`isNotNull()` now emit `{ kind: 'Compare', op: 'isNull' }` matching `lowerToSQL` expectations (was runtime crash)
- **C2:** Validate `ParamRef.typeHint` against safe-type regex to prevent SQL injection
- **C3:** Validate `Literal.type` against safe-type regex to prevent SQL injection
- **C4:** Validate ORDER BY `nulls` to `'first'`|`'last'` only (was injectable)
- **C5:** `cert-sign` canonicalizes with `{ ...json, signatures: [] }` to match `cert-verify`, fixing multi-signature verification
- **M1:** `qir` subcommand `.action()` handlers merge parent program opts (`--verbose`, `--quiet`, `--json`)
- **M2:** `validateRealm` in rehearse error path wrapped in try/catch to prevent masking original error
- **M3:** Migration SQL emission validates `s.type`, `s.using`, `s.default` against safe regexes
- **M4:** `LIMIT`/`OFFSET` validated as finite non-negative numbers (was emitting `NaN`)
- **M5:** `Cursor.mjs` exported from barrel `index.mjs`
- **M6:** `Cursor.mjs` uses `btoa`/`atob` instead of `Buffer` for browser compatibility
- **M7:** `ir-family-spec.md` references correct `plan-report.schema.json`
- **M8:** `ParamCollector` throws on unrecognized predicate kinds (defense-in-depth)
- **m1:** `generate.mjs` uses local `logger` instead of `this.ctx.logger` for ops registry validation
- **m2:** `cert-sign.mjs` and `cert-verify.mjs` use `fs.read()` to match host adapter contract
- **m3:** `generate.mjs` uses `this.ctx.env` and `this.ctx.shell` instead of `process.env`/`globalThis`
- **m4:** Extract shared migration helpers to `_migration-plan.mjs` (eliminates duplication)
- **m5:** `emit.mjs` delegates to shared `sanitizeIdentBase` from `identifiers.mjs`
- **m6:** `decodeCursor` strips `__proto__`/`constructor` keys after `JSON.parse`
- **m7–m9:** Documentation uses present tense for shipped schemas; correct bats test paths
- **m10–m11:** Remove dead `DistinctOn`, `Cast`, `CaseWhen` branches from `ParamCollector`
- **n1:** Remove pointless `catch (e) { throw e }` in `cert-verify.mjs`
- **n2:** Bats tests use robust `setup()` with `ROOT_DIR`/`CLI` pattern and `WESLEY_REPO_ROOT`
- **n3:** `renderJsonAgg` passes `opts` to `renderOrderBy`
- **n4:** Moot — the private RESERVED set in `emit.mjs` was removed when `sanitizeIdentBase` was consolidated (see m5)
- **n5:** Remove trivial `escIdent` wrapper; use `renderIdent` directly
- **n6:** `qir-envelope-schema.bats` removes redundant `export` (keeps `env` prefix)
- **n7:** `plan-report.schema.json` removes redundant `additionalProperties: true`
- **CR-22:** `plan-report.schema.json` — add `additionalProperties: false` to Phase items, Mapping items, and Radar object (Step/StepWithLock intentionally omitted due to `allOf` + draft-07 interaction)
- **CR-23:** `shipme.schema.json` — normalize `$ref` from absolute URL to relative path (`realm.schema.json#`)
- **CR-30:** Strip extra trailing newlines from JSON schema files (`qir`, `ir-envelope`, `ir`, `ops-manifest`, `ops-registry`, `realm`); add missing trailing newline to `evidence-map`
- **CR-35:** `qir.schema.json` — simplify `Literal.value` from verbose `oneOf` (6 JSON types) to equivalent `{}`
- **CR-16:** `assertCleanGit` prefers async `shell.exec()` over awaiting synchronous `execSync`
- **CR-34:** `lockFor` in `_migration-plan.mjs` — add clarifying comment explaining PG 11+ ADD COLUMN lock behavior

#### ESLint Fixes — Promise, Async, and Misc Rules

- Fix `promise/param-names` in `BatchOptimizer.mjs` and `TasksSlapsBridge.mjs` — rename unused resolve parameter from `_` to `_resolve`
- Fix `promise/always-return` in `ErrorRecovery.mjs` and `DocumentationGenerator.mjs` — add `return undefined` in `.then()` callbacks
- Fix `no-async-promise-executor` in `AdvisoryLockManager.mjs` — replace async executor with `Promise.resolve().then()` chain
- Fix `no-constant-binary-expression` in `StandardSanitizer.mjs` — remove redundant constant `\`SET ${nextTok}\``on left side of`&&`
- Fix `no-return-await` in `sql-executor.test.mjs` — remove redundant `await` from `return await`
- Fix `no-control-regex` in `createNodeRuntime.mjs` — add `eslint-disable-next-line` comment for intentional null byte detection

#### QIR Phase C — Self-Review Round 3

- **SR-M1:** `lowerToSQL` LIMIT/OFFSET now requires integer values (`Number.isInteger`) — fractional values like `5.5` are rejected instead of producing invalid SQL
- **SR-M2:** `renderLiteral` rejects `NaN` and `Infinity` number values — previously emitted as bare `NaN`/`Infinity` SQL tokens
- **SR-M3:** DISTINCT ON prefix logic rewritten — removes matching entries from orderBy first, then prepends in distinctOn order (preserves user direction/nulls); prevents duplicate ORDER BY entries when user orderBy has the same expressions in a different order
- **SR-M4:** `encodeCursor`/`decodeCursor` use TextEncoder/TextDecoder pipeline for UTF-8-safe base64 — previously crashed on multi-byte Unicode (emoji, CJK) via Latin1-only `btoa`
- **SR-M5:** `emitMigrations` emits `DEFAULT` for any column with a default value and `NOT NULL` for non-nullable columns — previously only emitted `DEFAULT` when `nullable === false`, silently dropping defaults on nullable columns
- **SR-M6:** Migration `DEFAULT` validation switched from denylist regex to strict allowlist (`SAFE_DEFAULT_RE`) — accepts numeric literals, booleans, bare function calls (`now()`), and single-quoted strings only
- **SR-M7:** `loadMoriartyHistory` receives env via parameter — removed direct `process.env` access for `WESLEY_BASE_REF`, `GITHUB_BASE_REF`, `WESLEY_DEFAULT_BRANCH`, `GITHUB_DEFAULT_BRANCH`
- **SR-M8:** `loadMoriartyHistory` receives logger via parameter — replaced four `console.warn` calls with injected `logger.warn`
- **SR-M9:** `plan.mjs` `assertCleanGit` accepts `shell` parameter from `this.ctx.shell` and uses async `shell.exec()` — removed `globalThis` access and synchronous `execSync`
- **SR-M10:** `schemaValidator.mjs` `loadSchemaFile` prefers `ctx.cwd?.()` over bare `process.cwd()` fallback; added `await` on import.meta.url fallback path; added directory math comment
- **SR-M11:** Document mixed JSON Schema drafts (draft 2020-12 vs draft-07) in `docs/spec/ir-family-spec.md`
- **SR-M12:** `plan-report.schema.json` adds `additionalProperties: false` to `plan`, `explain`, and root objects; adds `description` to `Step` definition explaining why `additionalProperties` is intentionally omitted (draft-07 `allOf` constraint)
- **SR-M13:** `realm-schema.bats` test renamed from "validates against realm.schema.json" to "emits plan-report shape" — dry-run output is plan-report, not realm; added `mapping` and `radar` key assertions
- **SR-m2:** `renderExpr` duck-typing fallbacks marked as backward-compat shims; logged to `.claude/bad_code.md`
- **SR-m3:** `identifiers.mjs` RESERVED set updated to PostgreSQL 16 — added `alter`, `any`, `cast`, `drop`, `grant`, `index`, `revoke`, `set`, `trigger`, `window`, `with`
- **SR-m9:** `cert-sign.mjs` uses `TextEncoder` for UTF-8 data signing instead of `Buffer.from()`
- **SR-m13:** `generate.mjs` repo root resolution prefers `ctx.cwd?.()` over bare `process.cwd()` fallback
- **SR-m14:** `generate.mjs` registry read uses `String()` instead of `.toString('utf8')` for host-adapter compatibility
- **SR-m15:** `generate.mjs` ops registry and entry `schema` fields use `normalizedSchema` (lowercased) to match emitted SQL
- **SR-n1:** `decodeCursor` uses `JSON.parse` reviver to filter `__proto__`, `constructor`, and `prototype` keys during parsing
- **SR-n5:** Default join alias uses full table name (`j_${table}`) instead of first character to prevent collisions
- **SR-n6:** `renderSearchPath` JSDoc documents lowercase-folding behavior
- **SR-n10:** Remove duplicate `-v, --verbose` option from `generate` subcommand (already on root program)
- **SR-n12:** `WesleyCommand.mjs` `process.env.WESLEY_LOG_FORMAT` mutation documented as known DI violation
- **SR-n15:** `qir.schema.json` root self-reference `QueryPlan: { "$ref": "#" }` logged to BACKLOG for future tooling compatibility
- **SR-n17:** `ops-explain.bats` `--i-know-what-im-doing` flag documented with inline comment
- **SR-n18:** `cert-e2e.bats` jq assertions simplified from fragile `if has(...) then ... else empty end` to direct `.validSignatures == 2` / `.ok == true`
- **SR-n19:** `qir-schema.bats` header comment explains why bats-assert plugins are not loaded (inline Node.js test)

#### QIR Phase C — Self-Review Round 2

- **SR-m1:** Document `findIndexByNameOnly` fallback in `lowerToSQL.mjs` — explains when the name-only param lookup legitimately triggers and its silent-binding risk
- **SR-m4:** `ParamCollector` now visits `distinctOn` expressions — previously skipped, causing uncollected params when `distinctOn` referenced a `ParamRef`
- **SR-m5:** `emit.mjs` imports `RESERVED` from `identifiers.mjs` instead of maintaining a separate (diverged) local copy
- **SR-m6:** `OpPlanBuilder.parseRef` array branch explicitly checks for empty-string, null, and undefined table elements instead of relying on falsy coercion
- **SR-n2:** `emitFunction` wrapping alias `q` is now quoted via `sqlQuoteIdent` — consistent with strict identifier policy
- **SR-n3:** Remove dead `forceCast`/`!/::/.test(typeHint)` guard in `renderParam` — `SAFE_TYPE_RE` already prevents `::` in type hints
- **SR-n4:** `PredicateCompiler.mjs` re-exported from QIR barrel `index.mjs`

#### Pre-review fixes

- **QIR:** `lowerToSQL` recursive calls (Subquery, Lateral, ScalarSubquery, Exists) now pass full `opts` — preserves `pkResolver` and `identPolicy` in nested queries; also threads `opts` through `renderOrderBy`
- **QIR:** `lowerToSQL` join-type handling is now explicit (LEFT, INNER) and throws on unsupported types instead of silently defaulting to JOIN
- **QIR:** `lowerToSQL` DISTINCT ON prefix uses position-based matching — preserves existing direction/nulls, supports multi-column distinctOn
- **Cert:** `cert-sign` now validates key type is ed25519 before signing, preventing silent algorithm mismatch
- **Cert:** `cert-verify` no longer masks infrastructure errors (import/parse) as `VALIDATION_FAILED`
- **Ops:** `resolveManifestEntries` exclude matching uses normalized absolute-path prefix comparison (handles subtree excludes and Windows paths)
- **Ops:** `compileOpsIfRequested` reuses parsed manifest for `allowEmpty` check instead of re-reading file (fixes TOCTOU)
- **Ops:** Manifest auto-discovery no longer overrides explicit `--ops` flag
- **Schema:** `realm.schema.json` now requires `error` field when `verdict` is `FAIL`
- **Schema:** `shipme.schema.json` SHA field constrained to hex hash pattern (40 or 64 chars); signature identity fields (`signer`, `keyId`, `signature`) require non-empty strings
- **Schema:** `ops-manifest.schema.json` `schema` property rejects empty strings
- **CI:** `ops-explain.bats` and `qir-schema.bats` use fallback repo root when `WESLEY_REPO_ROOT` is unset
- **Preflight:** CLI binary existence check — removed broken `node_modules/.bin/wesley` shell-shim fallback; fails fast when primary entry point is missing
- **Preflight:** `git diff`/`git ls-files` failure now detected and reported instead of silently skipping validations
- **Preflight:** Registry path matching is now path-separator-agnostic (Windows-safe)
- **E2a.2:** TS codec NaN canonicalization used big-endian instead of little-endian — now matches Rust `to_le_bytes`
- **E2a.2:** TS codec nested object decode closure did not advance offset — caused corrupt state in lists/options
- **E0.1:** `ArtifactWriter` path traversal vulnerability — artifact keys with `..` or absolute paths are now rejected
- **E2d.1:** Golden vector reference encoder used `localeCompare` (non-deterministic across platforms) — now uses byte-order comparison
- **E1.7:** `wesley diff --breaking-only --format json` now emits only filtered `{ changes }` (no unfiltered delta arrays)
- **E2a.2:** Replace all `localeCompare` with byte-order comparison across codegen (emitRawLeCodec, emitRawLeTsCodec, emitGuardedViews, index.mjs)
- **E2a.2:** TS codec nested encode now uses in-place `_encode` helpers — eliminates intermediate `Uint8Array` allocation per nested object
- **E2d.1:** Golden vector `resolveNanSentinels` now recurses into arrays and array fields
- **E2d.1:** Golden vector `unwrapType` now throws on missing node name instead of returning `'Unknown'`
- **E2d.1:** Golden vector test runner now guards against missing `typeName` in fixture files

#### Self-Review Round 7 — Error Handling, Hardening, and Hygiene

- **SR-m7:** `verifySig` in `cert-verify.mjs` now distinguishes crypto mismatches (returns `false`) from infrastructure errors (re-throws) instead of swallowing all errors via bare `catch {}`
- **SR-m8:** `extractJsonBlock` in `_cert-utils.mjs` asserts marker ordering (`begin < fence < fenceEnd < end`) after position lookup, returning `null` on misordered markers
- **SR-m10:** `qir-validate.mjs` parent `qir` command now shows help when invoked without a subcommand instead of throwing
- **SR-m11:** `qir-validate.mjs` subcommand `.action()` handlers use dynamic root-walk (`while (root.parent) root = root.parent`) instead of hardcoded `command.parent?.parent?.opts?.()`
- **SR-m12:** Health probe SQL in `rehearse.mjs` escapes double quotes in table names (`replace(/"/g, '""')`) to prevent SQL injection via `t.name`
- **SR-m18:** Snapshot.json read failures in `plan.mjs` and `rehearse.mjs` now distinguish `ENOENT` (silent) from parse/infrastructure errors (logged via `logger.warn`)
- **SR-n7:** `canonicalize` in `_cert-utils.mjs` uses explicit comparator `(a, b) => a < b ? -1 : a > b ? 1 : 0` instead of locale-dependent `.sort()`
- **SR-n8:** `hashArtifacts` in `cert-create.mjs` logs debug message on file hash failure instead of swallowing errors via bare `catch {}`
- **SR-n9:** `cert-create.mjs` uses static `import { createHash } from 'node:crypto'` instead of dynamic `await import('node:crypto')` inside `hashArtifacts`

#### Self-Review Round 8 — Schema, Docs, and Hygiene

- **SR-n14:** `realm.schema.json` `if` condition now includes `"required": ["verdict"]` so the conditional `then` clause only fires when `verdict` is actually present
- **SR-n16:** `shipme.schema.json` `alg` field gains a description noting supported values (`"ed25519"` or null)
- **SR-n11:** Index dedup signature in `_migration-plan.mjs` now includes the `using` method (defaults to `btree`), preventing false dedup of indexes on the same columns with different access methods
- **SR-m16:** `docs/spec/ir-family.md` now documents Plan IR, REALM IR, Ops Manifest, and Ops Registry alongside Schema IR and QIR
- **SR-n20:** `docs/build-artifacts.md` changes `out/ops/` description from "Experimental" to "Generated" to match current enabled status
- **SR-m17:** `docs/guides/qir-ops.md` "See also" reference reformatted as a proper markdown link (target file exists)
- **SR-n22:** Strip extra trailing blank lines from fixture JSON files (`sample-flat.qir.json`, `sample-envelope.json`, `ops.manifest.json`)
- **SR-n23:** Strip extra trailing blank lines from spec docs (`qir.md`, `ir-family.md`)
- **SR-m19:** `qir-envelope-schema.bats` now asserts output content (not just exit code) after `envelope-validate`
- **SR-m20:** Verified: `holmes-setup/action.yml` omits explicit pnpm version because `pnpm/action-setup@v4` reads `packageManager` from `package.json` — no change needed

#### CodeRabbit Round-6 (PR #392)

- **CR-R6-1 (Critical):** `renderSearchPath` in `emit.mjs` now preserves PostgreSQL special variables (`$user`, `pg_temp`) verbatim instead of mangling them through `sanitizeIdentBase`
- **CR-R6-2 (Critical):** `collectParams(plan)` in `emitFunction` no longer called twice — result is now passed to `lowerToSQL` as `paramEnv`
- **CR-R6-3 (P2):** `emitOpArtifacts` normalizes `targetSchema` via `sanitizeIdentBase` before `CREATE SCHEMA IF NOT EXISTS`, ensuring schema name matches function emission
- **CR-R6-4 (Major):** Extract shared `schemaValidator.mjs` helper — centralises Ajv instantiation, format registration, and dual-path schema resolution (WESLEY_REPO_ROOT → import.meta.url fallback) across cert-verify, generate, plan, qir-validate, and rehearse commands
- **CR-R6-5 (Major):** `plan.mjs` catch block no longer mislabels infrastructure errors (import/parse) as `VALIDATION_FAILED`
- **CR-R6-6 (Major):** `rehearse.mjs` dry-run now validates and emits the same shape (full plan-report with mapping/radar stubs)
- **CR-R6-7 (Major):** `qir-validate.mjs` four nearly identical branches consolidated into `_validate()` dispatcher
- **CR-R6-8 (Major):** Join ambiguity diagnostic in `OpPlanBuilder` now catches all unqualified string refs, not just `'id'`
- **CR-R6-9 (Minor):** `decodeCursor` now returns `{}` for non-object payloads (arrays, primitives)
- **CR-R6-10 (Minor):** `plan.mjs` non-JSON path now returns `{ phases, steps }` matching JSON return shape
- **CR-R6-11 (Minor):** `qir-ops.md` markdown lint fix — add blank line after fenced code block
- **CR-R6-12 (Trivial):** `emitView`/`emitFunction` comments clarify intentional `identPolicy` default difference vs `lowerToSQL`
- **CR-R6-13 (Trivial):** `pkResolver` in `generate.mjs` gains JSDoc documenting single-table/left-deep limitation
- **CR-R6-14 (Trivial):** `ops-registry.schema.json` `params` array gains description noting uniqueness enforced at generation time
- **CR-R6-15 (Trivial):** Bats tests `plan-report-schema.bats` and `realm-schema.bats` now assert output content, not just exit status
- **CR-R6-16 (Trivial):** Test coverage: cursor null/undefined/non-object edge cases, qualified join refs positive path, builder-based pkResolver test, LIKE/CONTAINS param guard tests

## [0.1.0] - 2025-09-01

- Initial public repository layout

[Unreleased]: https://github.com/flyingrobots/wesley/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/flyingrobots/wesley/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/flyingrobots/wesley/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/flyingrobots/wesley/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/flyingrobots/wesley/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/flyingrobots/wesley/releases/tag/v0.0.1
