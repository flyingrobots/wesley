# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Added a Plain Wesley first-hour docs path with a beginner compiler tutorial,
  GraphQL-to-Wesley term map, contributor tutorial, and public-vocabulary rule
  for new docs terminology.
- Added an assurance capability matrix that separates shipped native CLI
  evidence commands, transitional JavaScript tooling, Rust foundation code, and
  concept-only assurance vocabulary.
- Added an external target protocol MVP specification for future
  descriptor-verified external-process target execution with host-enforced
  capability denial, bounded execution, deterministic command resolution, and
  staged artifact copy-out.
- Added `cargo xtask bench-ir`, an advisory Rust-native IR lowering benchmark
  that generates scale fixtures, reports structural counters and timing
  summaries, and can write JSON release evidence.
- Added a first-PR contributor path with docs-only, fixture-only, emitter-test,
  and CLI bug fast lanes plus maintainer starter-issue checks.
- Added a security-tooling posture topic that records Wesley's current scanner
  baseline, rejects DAST for the current compiler-only surface, and gates future
  Semgrep or `cargo-deny` adoption on low-noise repo-owned policies.
- Added CLI regression coverage for missing schema file diagnostics.

### Changed

- Required PR bodies to reference at least one GitHub Issue and to use GitHub
  closing keywords for every fully resolved issue.

### Fixed

- Rejected duplicate non-repeatable custom directives during SDL lowering,
  including duplicates split across type definitions and extensions, while
  preserving ordered arrays for directives declared `repeatable`.
- Escaped law-backed Rust validator error messages before emission so hostile
  case values containing quotes, backslashes, or control characters cannot break
  generated Rust source.

## [0.2.0] - 2026-06-26

### Added

- **Project manifest and config CLI**: Added the domain-free
  `wesley.project-manifest/v1` JSON/YAML manifest with schema paths, bundle
  directories, rebuild globs, comment mode, dashboard settings, and generic
  target metadata. The native CLI now exposes `wesley config validate`,
  `wesley config inspect`, and `wesley config changed-schemas`; single-schema
  manifests can also provide the default schema for `schema lower`, `schema
hash`, and `schema operations`.
- **Fixture module zoo**: Added descriptor-only compiler-heavy,
  evidence-heavy, and BLADE-heavy fixture modules under
  `test/fixtures/extensions/fixture-zoo`, with domain-empty regression guards.
- **Contributor onramp**: Added a public near-term roadmap issue and scoped
  `good first issue` starter tasks, and linked the onboarding path from
  `CONTRIBUTING.md`.
- **Comprehensive topic map**: Expanded `docs/topics/` into a current operator
  and contributor map covering the native CLI, schema IR, operations,
  directives, emitters, artifacts, compiler boundaries, project manifests,
  extension modules, legacy Node retirement, CI, HOLMES, releases, invariants,
  and docs maintenance.

### Changed

- **Release lifecycle profile**: Added a repo-local `.continuum/release.yml`
  release profile and expanded the Wesley release doctrine/runbook around
  thesis, scope, goalposts, immutable tagged-main publication, verification,
  and retrospective evidence.
- **Release process front door**: Added a thin root `RELEASE.md` and clarified
  how Wesley adapts the Continuum release lifecycle around goalpost milestones,
  version labels, manual signed tags, crates.io publication, and patch-forward
  failure handling.
- **Release documentation gate**: The release runbook, release policy, and
  human sign-off checklist now require a `docs/topics/` accuracy and coverage
  audit before tagging, with minimum 90% accuracy and 90% coverage floors.
- **HOLMES schema selection**: The HOLMES workflow now reads the Wesley project
  manifest first, computes changed schema sets with `wesley config
changed-schemas`, runs schema-scoped matrix jobs, and keeps per-schema report
  artifacts grouped for one aggregate PR comment.
- **HOLMES distribution direction**: Documented tagged reusable GitHub Actions
  workflows plus copy/paste templates as the user-facing HOLMES install path,
  with GitHub App delivery deferred to future identity or Checks API needs.
- **Extension documentation**: Added current project-manifest and module
  authoring references, and clarified that `wesley.config.mjs` and the dynamic
  JavaScript module loader are retired from generic Wesley core.
- **Release signposts**: Refreshed README, GUIDE, ENTRYPOINTS, ARCHITECTURE,
  METHOD, CONTRIBUTING, and docs topic routing so the current docs point at the
  domain-free GraphQL-to-IR platform and the topic map rather than stale
  backlog or retired command surfaces.
- **Launch signpost honesty**: Refreshed the pre-tag launch wording across
  README, GUIDE, ENTRYPOINTS, docs site, BEARING, TECHNICAL_TEARDOWN, release
  topics, and docs-maintenance topics so `v0.2.0` install commands are present
  without claiming publication before the signed tag workflow completes.

### Fixed

- **Release crate visibility check**: The tag-triggered Release Crates workflow
  now verifies crates.io visibility for `wesley-emit-codec` along with the rest
  of the published Rust crate set, with bounded registry-index retries before
  finalizing the GitHub Release.
- **Release version-source enforcement**: `cargo xtask release-prep-guard`,
  `cargo xtask release-guard`, `cargo xtask package-crates`, and
  `cargo xtask publish-crates` now reject root `package.json` and unpublished
  required Cargo manifest version drift in addition to published Rust crate
  manifest drift.
- **Release issue blocker selection**: Release guards now rely on exact-version
  issue text and `vX.Y.Z` labels for pre-tag blockers while allowing the
  `Release: vX.Y.Z` gate issue to remain open for post-publication evidence and
  closeout.
- **Release advisory-audit profile**: The repo-local release profile now
  declares the Rust advisory audit command alongside the other release
  validation gates.
- **Release signpost profile coverage**: The repo-local release profile now
  includes the public MkDocs source and guide page in user-doc signposts so
  profile-driven audits cover public release wording.
- **Post-merge SHIPME certification**: `cert-shipme.yml` now runs only on
  `main` pushes, so SHIPME certificates bind to the landed target-branch SHA
  instead of racing PR-time HOLMES comments for a temporary merge SHA.
- **Docs CLI checker determinism**: The docs command checker now reads the
  native command list from the Rust CLI source help text instead of invoking
  `cargo run`, so Node-only repository hygiene does not depend on Cargo
  registry/network state or cascade help-load failures into false doc command
  errors.

### Removed

- **Rust Holmes law capability alias**: `wesley-holmes` no longer accepts the
  pre-canonical `wesley.capability-report/v1` input alias. Law capability
  ingest now accepts only the canonical `wesley.law-capabilities/v1` artifact
  API version.

## [0.1.1] - 2026-06-26

### Removed

- **External host experiments**: Retired the browser, Bun, and Deno host
  experiment packages, workflows, smoke scripts, browser contract fixtures, and
  active docs references from the Wesley release surface. Wesley now treats
  host-specific execution as downstream extension scope rather than core repo
  product surface.
- **Website/playground surface**: Removed the old `wesley-website` Vite/React
  product site, playground/PGLite leftovers, Pages workflow, preview script,
  and active James website planning docs. Wesley keeps documentation under
  `docs/` and `docs/site`; product websites and playgrounds must be owned
  outside this repo unless a future Wesley release explicitly reslates them.

### Changed

- **v0.1.0 release evidence**: Recorded the signed tag, GitHub Release,
  Release Crates workflow, and crates.io publication evidence for the published
  `v0.1.0` release, and tightened the release doctrine so future releases treat
  the signed tag on synced `main` as the repo release boundary instead of
  relying on manual post-release evidence backfills.
- **Roadmap governance**: Moved Wesley's live roadmap model to GitHub Issues,
  `Goalpost: ...` milestones, `Release: ...` milestones, the Wesley Roadmap
  Project, and labels. Repo docs now define direction and evidence instead of
  tracking live backlog/progress state.

### Fixed

- **v0.1 public API compatibility**: `wesley-core` now keeps deprecated
  `compile_runtime_optic` and `compile_runtime_optic_registration` aliases for
  the renamed operation artifact compiler entry points, preserving compatible
  `0.1.x` Cargo updates while the generic vocabulary remains primary.
- **Vendored Bats helper resolution**: Repo-level Bats tests now resolve
  `bats-support`, `bats-assert`, and `bats-file` from tracked files under
  `test/vendor/bats-plugins`; CI no longer clones or downloads those helpers at
  runtime.
- **Generated JSON schema validation**: Added integration coverage that checks
  representative generated IR, Weslaw, law diff, contract manifest, Holmes
  scores/evidence, runtime, REALM, and SHIPME JSON artifacts against their
  declared schemas, and made Rust product CI watch schema and Weslaw fixture
  changes.
- **Workflow policy regression guards**: GitHub workflow tests now pin bot
  comment updater behavior, PR rollback/backout metadata, and frozen pnpm
  installs with lockfile drift checks across workflow and composite-action
  setup paths.
- **Package manager policy**: Legacy preflight now enforces the
  `packageManager` pnpm pin and single-root-lockfile policy; CI setup reads the
  pnpm version from `package.json`, and contributor docs describe Corepack,
  frozen installs, and the selective pre-commit lockfile refresh hook.
- **Release guard version scheduling**: `cargo xtask release-prep-guard` and
  `cargo xtask release-guard` now block on concrete `vX.Y.Z` release labels for
  the release being cut, recognize older `v*` labels as prior-version blockers,
  and no longer depend on the retired generic `lane:*` labels.
- **Directive example honesty**: Current-path example fixtures now use only
  directive families that the Rust-native SDL hot path actually lowers, while
  broader RLS/RPC/reference fixtures are explicitly marked experimental or
  historical.

## [0.1.0] - 2026-06-24

### Added

- **Shared LE binary codec plan**: Added `wesley-emit-codec`, a
  language-neutral LE-binary codec planning crate. Rust and TypeScript codec
  emitters now consume the same `CodecDef`/`CodecOp` plan instead of duplicating
  generator-side codec lowering.
- **LE binary runtime port contracts**: Generated codec modules now expose the
  `Writer`, `Reader`, and `CodecError` port shapes required by the generated
  runtime boundary.
- **LE binary Rust codec emitter**: `wesley emit le-binary-rust` (and
  `wesley_emit_rust::emit_le_binary_rust`) emits Rust `encode_*`/`decode_*`
  functions over a consumer-provided `Writer`/`Reader`/`CodecError` runtime,
  with a wire format identical to `le-binary-typescript` — enums as a `u32` LE
  ordinal discriminant, `Int`/`Float` as `i32`/`f32` LE, length-prefixed UTF-8
  strings, tagged options, length-prefixed lists. Covers enums, input and output
  objects, and operation variables (the generated `*Request` struct), so a Rust
  producer and a TypeScript consumer interoperate byte for byte. This lets
  domain repos (echo, jedit) drop their hand-mirrored Rust codecs.
- **LE binary output-object codecs**: both the TypeScript and Rust LE binary
  emitters now emit codecs for output `type` objects (not just `input`),
  excluding operation root types, so domain-empty data contracts round-trip.

### Changed

- **TypeScript LE binary decode result contract**: Generated TypeScript
  `decode*` functions now return `Result<T>` instead of returning raw decoded
  values and throwing through the public API. Internals still use ordinary
  throwing helpers, with one boundary wrapper converting failures to `err`.
- **Codec emitter drift reduction**: Rust and TypeScript LE-binary emitters now
  render from the shared codec plan, preserving the existing TypeScript golden
  bytes for the pure refactor slice before the public decode contract changed.
- **Emitter syntax-model boundary**: Locked TypeScript and Rust code generation
  behind explicit syntax-model-to-printer pipelines. The LE binary TypeScript
  codec emitter now constructs a crate-local TypeScript syntax model before
  rendering, keeping raw source string writes at the printer boundary.
- **Wesley core extension boundary**: Removed generic runtime dispatch ID
  helpers from `wesley-core` and stopped exporting TypeScript `OP_*` constants
  from the generic LE binary emitter. Target-owned extensions must now supply
  runtime operation identifiers instead of inheriting them from Wesley core.
- **Runtime optic authority vocabulary**: Kept compiler-owned optic artifact,
  requirement, and law witness evidence in `wesley-core`, but removed
  host-issued handle, grant, presentation, ticket, basis, aperture, budget, and
  observer authority structs from the generic core model.
- **Strict quality gate**: `cargo xtask preflight` is now the canonical
  pre-PR and release quality gate. It runs `cargo fmt --check`,
  `cargo clippy --workspace --all-targets -- -D warnings`,
  `pnpm audit --prod=false --json`, docs checks, workspace tests, and a native
  CLI smoke test. `cargo xtask strict-preflight` is an alias, and
  `cargo xtask release-check` starts with the same gate before release artifact
  validation.
- **Method tracker migration**: GitHub Issues are now Wesley's live Method work
  tracker. Former filesystem backlog cards were migrated to GitHub Issues with
  Method lane/legend labels, and the local backlog tree now points to the
  archived migration evidence under `docs/method/graveyard/`.
- **Release signpost accuracy**: Refreshed README, GUIDE, ENTRYPOINTS,
  ARCHITECTURE, TECHNICAL_TEARDOWN, release packet signposts, release runbooks,
  and xtask help so `0.1.0` describes the current LE-binary codec-plan release,
  names the shared `wesley-emit-codec` crate, distinguishes pre-tag source
  checkout usage from published crates.io installs, and marks the superseded
  `v0.0.6` planning packet as historical context.

### Fixed

- **TypeScript trailing-byte rejection**: TypeScript LE-binary public decode
  wrappers now reject trailing bytes after a top-level decode, closing the #603
  class for TypeScript and matching the Rust decoder guard.
- **Package advisory cleanup**: Added an `undici` override to the patched
  `7.28.0` line so `pnpm audit --prod=false --json` clears the latest
  transitive `jsdom` advisories surfaced during preflight.
- **Package advisory cleanup**: Removed the `rolldown-vite` alias that pulled
  `esbuild` `0.25.x` into the workspace and moved retained Vite tooling to the
  patched Vite 8 line so `pnpm audit --prod=false --json` reports zero known
  advisories.
- **Rust Holmes capability ingest review fix**: Report-only law capability
  ingest now rejects forbidden-resource contradictions across the full touched
  resource footprint, including reads, writes, creates, slot kinds, and closure
  reads, instead of checking only write/create overlaps.
- **`weslaw` capability artifact version drift**: The JSON output from
  `wesley law capabilities --json` now emits the PRD-canonical
  `wesley.law-capabilities/v1` API version.
  At `0.1.0`, Holmes also accepted the pre-canonical
  `wesley.capability-report/v1` string as a legacy input alias and normalized
  it internally.
- **Release guard tracker checks**: `cargo xtask release-prep-guard` and
  `cargo xtask release-guard` now query live GitHub Issues for open
  tag/version blockers by owned issue title/body, milestone, or label instead
  of relying only on the retired filesystem backlog tree. Third-party comments
  and automatic cross-reference chatter no longer create false release blockers.
- **Release governance hardening**: Release guards now require exact README and
  changelog release headings, validate real calendar dates, reject shell
  commands as guide path citations, require guide SHAs to be commit objects,
  authenticate GitHub Actions workflow-run checks with read permissions, and
  document suppression blast radius accurately.
- **Rust Holmes validation gate review fixes**: Law evidence validation now
  continues artifact checks when structure validation emits warning-only
  diagnostics, rejects duplicate artifact roles after workspace-relative path
  normalization, requires schema versions on every present artifact reference,
  and validates artifact `sha256` digests with artifact-specific diagnostics
  instead of allowing malformed digest anchors into later traceability gates.
- **Rust Holmes assurance review fixes**: The new Holmes artifact locator now
  returns stable Holmes diagnostics for invalid and escaping paths, rejects
  platform-specific backslash and drive-path input before normalization, the
  schema-version registry now fails closed when a family requirement is absent,
  semantic-version parsing rejects leading-zero identifiers, in-memory port
  writes are readable through the same fake store, and the crate metadata/docs
  no longer point at nonexistent or unpublished documentation.
- **`weslaw` semantic diff review fixes**: Law diffs now classify existing
  channel and invariant law modifications as modification events instead of
  additions, emit registry/tag/schema-hash events so changed `lawHash` values
  have a machine-readable cause, ignore programmatic draft entries in semantic
  hash input, and include `schemaHashQualified` in emit metadata while retaining
  the legacy bare `schemaHash` field. Follow-up PR review fixes now keep
  `--law` metadata schema hashes sourced from the validated manifest, reject
  non-object schema types as footprint resources unless they are explicit
  registry resources, preserve authored `laws[n]` indices in binding
  diagnostics after Law IR normalization, reject unknown `law coverage`
  profiles, and rebind only the authored `schema.hash` anchor instead of
  unrelated hash mentions.
- **`weslaw` Law IR loader review fixes**: The loader now rejects wrong-typed
  optional sequence fields and invariant predicates with fields from another
  predicate operation, the published Law IR JSON Schema now discriminates each
  entry `kind` against its normalized `body`, normalized Law IR now excludes
  draft entries and sorts active entries by id, scalar semantic relationship
  rules are enforced during loading, draft scaffolding is filtered before active
  kind/body validation, scalar ordering is a closed v1 vocabulary, and the
  scalar semantics docs now match the shipped v1 surface. Footprint closure
  cardinality now accepts the authoring-schema default of `one` when omitted and
  rejects values outside the closed `one`/`optional`/`many` vocabulary.

### Added

- **Rust Holmes law assessment and policy substrate**: Extended the unpublished
  `wesley-holmes` crate through `HIMP-035` with bundle traceability gate
  decisions, deterministic provenance report data, aggregate assessment outcome
  rules, bounded finding summaries, domain snapshots, typed
  `holmes.law-assurance-policy/v1` parsing and normalization, profile
  inheritance, law diff event and coverage gate severity mappings, materialized
  coverage threshold policy, and narrow suppression rules with owner, reason,
  expiration, allowed-severity, and audit metadata.
- **Rust Holmes law assessment substrate**: Extended the unpublished
  `wesley-holmes` crate through `HIMP-025` with normalized law coverage
  subjects, category percentages, missing-subject display/omission accounting,
  strict coverage count validation, report-only law capability ingest,
  contract bundle manifest ingest with evidence-bundle provenance
  cross-checks, stable semantic change findings derived from Wesley law diff
  events without reclassifying event kinds, and profile/category law coverage
  gate decisions with pass/warn/fail/unavailable outcomes.
- **Rust Holmes law diff ingest**: Added the first `LawDiffIngestPort`
  implementation for `wesley.law-diff/v1` JSON artifacts, preserving Wesley's
  event classifications, law ids, subjects, field changes, hash anchors, and
  footprint resource deltas inside typed Holmes report data. The report now
  exposes stable normalized event records with `lawDiff.changes[n]` event refs
  and copied schema/law hash anchors while rejecting malformed JSON,
  unsupported diff API versions, unknown event kinds, malformed diff hashes, and
  duplicate law-id/event identities before assessment.
- **Rust Holmes law coverage ingest**: Added the first
  `LawCoverageIngestPort` implementation for current
  `wesley.law-coverage/v1` JSON artifacts, preserving profile, required
  aggregate totals, per-category required posture, covered/total counts, and
  missing subject coordinates while rejecting malformed JSON and unsupported
  coverage API versions before assessment.
- **Rust Holmes law evidence validation gate**: Extended the unpublished
  `wesley-holmes` crate with collected law evidence validation results,
  required-versus-optional bundle artifact validation, canonical provenance
  hash/source checks, deprecated schema-version warnings, artifact-local
  version checks for law diff/coverage/capability/manifest evidence, and an
  application-layer validator that loads artifacts through deterministic ports
  while reporting unavailable, unreadable, and oversized artifacts without
  panics.
- **Rust Holmes assurance foundation**: Added the unpublished
  `crates/wesley-holmes` workspace crate with a hexagonal module shell, domain
  dependency-boundary tests, deterministic port traits and fakes, a structured
  diagnostic envelope, typed `HolmesLawEvidenceBundle` model, safe
  workspace-relative artifact path locator, and artifact-family schema-version
  registry for the first ten Holmes implementation slices.
- **`weslaw` v1 consumer payoff**: `wesley emit rust --law <path>` now emits
  law-backed helper validators for integer scalar semantics and discriminated
  input variant rules, `wesley law capabilities` emits report-only
  footprint-to-capability summaries without claiming runtime enforcement, and
  `wesley law coverage` reports profile/category-aware coverage for custom
  scalar semantics, variant inputs, mutation footprints, and channel law. The
  `0019` packet now closes the 75-slice `weslaw` v1 runway with playback,
  retrospective, release-readiness evidence, and an explicit Law Matrix v1.1
  deferral.
- **`weslaw` adoption tooling**: Added `@wes_channel` directive lowering into
  canonical Law IR, a fixture proving directive-authored channel law and
  YAML-authored channel law produce the same semantic `lawHash`, structure-only
  `wesley law lint`, `wesley init-law` scaffolding for known formal directives,
  description-derived draft suggestions that remain inactive until promoted,
  `wesley law explain` for scalar and operation subjects, and explicit
  `wesley law rebind` reporting plus `--accept --out <path>` output for
  schema-hash anchor updates.
- **`weslaw` strict schema binding**: Added Rust-core validation that requires
  active `weslaw/v1` documents to match the active `sha256:<64 lowercase hex>`
  schema hash, binds scalar/type/input/enum/field/operation/channel/family
  subject coordinates against Shape IR or explicit law registries, validates
  variant discriminator fields and enum values, validates footprint resource
  kinds and argument paths, validates typed invariant field and verifier
  references, rejects wrong subject kinds and contradictory active law, emits
  stable binding diagnostics, and exposes the strict pass through
  `wesley law validate --schema <path> --law <path>`.
- **`weslaw` canonical law hashes**: Added canonical semantic Law IR
  serialization, `lawHash`, provenance-bearing `lawDocumentHash`, empty-profile
  `profileHash`, contract `bundleHash`, and a versioned
  `wesley.contract-bundle-manifest/v1` JSON Schema. `wesley law validate` with
  `--json` now emits the bundle manifest, `wesley emit rust --law <path>`
  embeds `WESLEY_SCHEMA_HASH` and `WESLAW_HASH` constants in generated Rust,
  and emit metadata sidecars record law, profile, bundle, and Law IR codec
  hashes when a law file is supplied.
- **`weslaw` semantic diff substrate**: Added the versioned
  `wesley.law-diff/v1` JSON Schema and Rust-core law diff reports for
  added/removed law entries, scalar semantic field changes, variant case
  changes, footprint expansion/contraction/mixed-change events, channel version
  and channel body changes, invariant predicate changes, registry changes, law
  tag changes, schema-hash rebound events, strengthened/weakened law
  classifications, and binding-break events. The native
  `wesley law diff --old <path> --new <path> --json` command emits
  machine-readable semantic diff reports; `--format markdown` generates PR-ready
  summaries; CI and Holmes/BLADE-facing fixture outputs now exercise the public
  diff schema.
- **`weslaw` semantic Law IR design**: Added design packet `0019` defining
  `weslaw` as Wesley's semantic law layer for contract bundles, with typed Law
  IR, strict binding, schema-hash anchoring, canonical law hashes, structured
  semantic diffs, directive lowering, deferred SDL+ syntax, and explicit
  separation between law, policy, evidence, and judgment. The packet now tracks
  a 75-slice implementation runway with a mandatory scope checkpoint at
  `WLAW-050`, plus a locked `WLAW-001` through `WLAW-010` v1 substrate covering
  Law IR, coordinate and registry grammar, canonicalization, diagnostics,
  active/draft semantics, and accepted/rejected `weslaw/v1` fixtures. The next
  packet adds Rust Law IR v1 types, a `weslaw/v1` structure loader, stable
  duplicate-id/raw-expression/unknown-kind/unknown-field diagnostics, fixture
  lowering tests, and versioned canonical JSON Schema artifacts for
  `weslaw/v1` and `wesley.law-ir/v1`.
- **Holmes assurance hexagon design**: Added design packet `0018` describing a
  ground-up Rust Holmes redesign with hexagonal architecture, CLI/API/MCP
  interfaces, dependency-injected ports, and a reporting abstraction where
  GitHub PR comments are one publisher instead of the system center.
- **Parity sentinel archive**: Added the `0017` parity sentinel archive so
  JS/Rust parity scripts remain migration evidence while Rust self-consistency
  and fixture truth become the product release gate.
- **Package deletion blockers**: Added explicit blocker evidence for legacy
  packages whose deletion gates remain open after the Vue generator removal.
- **Legacy compatibility package matrix**: Added a Node-retirement
  compatibility matrix that names every remaining legacy package, its
  retirement lane, and the gate for deleting, extracting, or rebuilding it.
- **Legacy package retirement metadata**: Added machine-readable
  `wesley.retirement` metadata and private-package warnings for every package
  that remains in the Node retirement ledger.
- **Legacy command deprecation warnings**: The historical Node CLI now warns
  when `diff`, `doctor`, `generate`, `typescript`, or `ts` have native Rust
  replacements.
- **Capability ABI compatibility diagnostics**: Added Rust-core capability
  contract version requirements, host compatibility reports, typed
  `WASM_ABI_UNSUPPORTED` diagnostics, stateless runtime resource policy, and
  hermetic cross-host capability fixture verification for the next Node
  retirement slice.
- **Host compatibility boundary**: Added a Node-retirement design note
  classifying browser, Bun, Deno, and Node host packages as legacy
  compatibility surfaces rather than Rust product checks.
- **Rust module capability registry proof**: Added Rust-core target registry and
  WASM host-import policy fixtures covering no-module, default target, explicit
  target, duplicate target, execution-mode metadata, portability floor,
  requested/granted/denied capability reports, and deny-by-default pre-execution
  rejection for unavailable WASM host imports.
- **Rust-native doctor command**: Added `wesley doctor` with text and JSON
  output for narrow Rust-native health checks covering the native CLI, Rust
  lowerer, normalized SDL hash evidence, and Rust emitter crates without
  inspecting legacy Node config, plugins, or package state.
- **Native emit metadata**: `wesley emit rust` and `wesley emit typescript` now
  accept `--metadata-out <path>` to write deterministic JSON sidecars with the
  schema hash, generator identity, generator version, and `rust-native`
  execution mode.
- **Emitter retirement fixtures**: Added generic TypeScript operation-binding
  golden fixtures and a domain-empty Rust emitter fixture so retained emitters
  prove request/response bindings without leaking PostgreSQL, Echo, or jedit
  semantics.
- **Rust SDL normalizer**: Added `wesley normalize-sdl --schema <path>` and a
  Rust-core `normalize_schema_sdl` API that prints a deterministic,
  extension-folded SDL view from compiler facts, with golden fixtures for
  sorted types, fields, arguments, unions, defaults, and nested list
  references.
- **Normalized SDL hash evidence**: `wesley normalize-sdl --schema <path>
--hash` now emits a SHA-256 evidence hash for the normalized SDL view, and
  parser parity reports include normalized SDL hash evidence for accepted Rust
  fixtures.
- **Legacy Node retirement campaign**: Added design packet `0017`, a Node
  retirement ledger, and a 96-slice `BEARING` checklist that tracks the
  Rust-native front-door work required to remove Node as compiler, runtime,
  release, and documentation authority.
- **Node retirement guard**: Added a machine-readable Node retirement ledger and
  `cargo xtask docs-check` validation that requires package dispositions,
  guards primary docs against product-front-door `pnpm wesley` drift, and blocks
  new legacy JS core authority without an explicit allowance.
- **Rust core binding observatory**: Added `pnpm perf:bindings` and
  `pnpm perf:ir -- --observatory` to emit
  `rust-core-binding-observatory.v0` reports that separate Rust CLI, legacy JS
  in-process, future Node-to-Rust binding, future WASM binding, memory posture,
  and cutover criteria over the explicit IR fixture corpus.
- **Rust binding strategy packet**: Added design packet `0016` for the
  evidence-first Node/Rust/WASM cutover runway, including the binding and memory
  baseline evidence note and the Node Rust core binding strategy decision
  matrix.
- **End-to-end Wesley narrative**: Added `docs/END_TO_END.md`, a
  first-principles walkthrough of Wesley's authored SDL, Rust compiler facts,
  generic emitters, module boundary, assurance tooling, external ownership
  rules, and design rationale with flowchart, sequence, class, entity,
  state-machine, and mindmap diagrams.
- **Parser parity spike**: Added `pnpm parity:parser`, which compares legacy
  `GraphQLAdapter.parseSDL` acceptance with Rust `wesley schema lower`
  acceptance over explicit parser-sensitive fixtures, including valid SDL,
  syntax-invalid SDL, nested list SDL, and shared rejection of duplicate
  canonical directive aliases.

### Removed

- **Node host-contract shadow**: Deleted the last `HOST=node` host-contract
  entrypoint and made retained host-contract runs explicitly choose `browser`,
  `deno`, or `bun`.
- **Final legacy Node compiler surface**: Deleted `packages/wesley-core`,
  `packages/wesley-cli`, `packages/wesley-host-node`, and
  `packages/wesley-runtime-node`; removed their package workflows, CLI Bats
  suites, root `pnpm wesley` bridge, lockfile importers, progress rows, and
  stale dependency-cruiser/preflight shadows.
- **Legacy parity and performance scripts**: Removed JS/Rust parity and
  JavaScript performance observatory scripts after the Rust-native compiler
  spine became the release gate.
- **Legacy Node CI workflows**: Removed package-only CLI/core/host-node,
  fuzzing, quick CLI, and legacy parity/performance workflow coverage that
  depended on the retired Node compiler stack.
- **Legacy JavaScript generator package**: Deleted
  `packages/wesley-generator-js`, removed its package workflow, lockfile
  importer, progress row, host shims, and `models` command. Retained generic
  TypeScript output belongs in Rust emitters; Zod remains only as CLI-local
  compatibility debt.
- **Leaf legacy packages**: Deleted `packages/wesley-scaffold-multitenant`,
  `packages/wesley-test-fixtures`, and `packages/wesley-tasks`; removed the
  package-only `pkg-tasks` workflow, lockfile importers, progress rows, and the
  dead optional task-planner load from the Node host.
- **Vue generator package**: Deleted `packages/wesley-generator-vue` after the
  retirement ledger classified Vue projection output as target-owned behavior
  with no generic Wesley owner.
- **Nested-list type-family parity fixture**: Added
  `nested-list-schema.graphql` to the default `pnpm parity:ir` corpus under
  `js-sdl-type-family-vs-rust-l1-type-family.v0`, and taught the projection to
  compare nested list wrappers and leaf nullability.
- **Legacy JS performance comparison option**: `pnpm perf:ir` now supports
  `--include-legacy-js` to capture in-process legacy JS lowerer wall-clock
  samples beside Rust CLI lowering evidence without claiming Node binding,
  WASM, peak RSS, or cutover-threshold proof.
- **Hermetic module target zoo evidence**: Added module-loading tests proving
  multi-module compile target alias resolution and generated target schema-hash
  agreement without importing product or database semantics into Wesley core.
- **Rust IR performance baseline**: Added `pnpm perf:ir`, which measures Rust
  CLI `schema lower` wall-clock samples over the explicit valid Rust IR fixture
  corpus, including `large-schema.graphql`, and emits JSON or Markdown evidence
  without implying memory, binding-overhead, or cutover-threshold claims.
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
- **Resilience policy boundary packet**: Pulled the `ninelives`/Alfred decision
  into design packet `0015`, defining Rust compiler resilience seams,
  JavaScript child-process bounds, and the non-ownership line that keeps
  product, database, scheduler, and runtime semantics outside Wesley core.
- **Rust core resilience policy wrapper**: Added `ResiliencePolicy` and
  `ResilientLoweringPort` so Rust lowering callers can opt into explicit,
  cooperative `ninelives` timeout policy at async execution boundaries while
  preserving ordinary deterministic compiler errors. The wrapper does not claim
  hard preemption of synchronous CPU-bound parser work.
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

- **Post-retirement host lane language**: Live host docs, CI doctrine, and the
  retirement ledger now call browser/Bun/Deno checks `External Host Experiment`
  lanes instead of `Legacy Compatibility` lanes.
- **Post-retirement backlog notes**: Host portability backlog cards now mark
  pre-retirement Node-host acceptance text as obsolete instead of treating it as
  live execution guidance.
- **Holmes support ownership**: Holmes now carries its retained ledger,
  artifact-path, evidence-quality, and module-capability helpers locally rather
  than importing deleted JavaScript core/runtime packages.
- **Host experiment ownership**: Browser, Bun, and Deno host experiments now
  run self-contained smoke lowerers instead of importing the deleted JavaScript
  core.
- **Node retirement closeout docs**: BEARING, END_TO_END, ENTRYPOINTS,
  ARCHITECTURE, DIRECTIVES, GUIDE, legacy migration, and design packet `0017`
  now describe the 96/96-slice closeout and the post-retirement Rust-native
  direction.
- **Legacy CLI quick workflow**: Reclassified the CLI quick-check workflow as a
  legacy compatibility check and removed its extra direct host-node smoke; the
  package tests remain the compatibility proof.
- **Product health check**: `cargo xtask preflight` is now the ordinary product
  health gate, while `cargo xtask legacy-preflight` explicitly runs the
  historical Node package preflight only for legacy package or pnpm workspace
  changes.
- **Native docs command truth**: Documentation command drift checks now read
  the Rust-native `wesley --help` surface instead of treating the Node host CLI
  as front-door truth.
- **Rust-native documentation spine**: README, GUIDE, ENTRYPOINTS,
  ARCHITECTURE, END_TO_END, quick-start docs, package docs, and the release
  runbook now present native schema lower/hash/diff and Rust emitter commands
  as the normal path, with `pnpm wesley` documented as a migration bridge.
- **Package progress posture**: README package status now labels legacy npm
  packages as compatibility surfaces instead of product-front-door artifacts.
- **CI lane names**: Renamed Rust-native checks as `Rust Product`, repository
  checks as `Repository Hygiene`, and browser/Bun/Deno/Node host checks as
  `Legacy Compatibility`, and replaced the generic CI product schema smoke with
  the native Rust CLI.
- **Host package posture**: Marked `@wesley/host-node`,
  `@wesley/host-browser`, `@wesley/host-bun`, and `@wesley/host-deno` docs as
  legacy compatibility surfaces pending deletion or externalization.
- **Assurance command boundary**: Classified certificate, SHIPME,
  Holmes/Moriarty, run-ledger, validate-bundle, and package-level evidence
  commands as assurance or compatibility surfaces rather than native compiler
  front-door commands.
- **Legacy command retirement decisions**: Classified legacy `zod`, `models`,
  and `init` as externalized or retired core behavior, and narrowed legacy
  `generate` replacement to explicit native `emit` commands plus external
  target modules.
- **v0.0.6 bearing reset**: Reframed `docs/BEARING.md` around Rust IR parity,
  module-boundary enforcement, and explicit `wesley-postgres` preservation
  after the v0.0.5 clean-house release.
- **v0.0.5 release evidence**: Replaced pending publication wording with the
  actual GitHub Release, signed tag, workflow, and crates.io visibility
  evidence.

### Fixed

- **`weslaw` substrate self-audit**: Removed the inline footprint directive
  shadow from the shared `weslaw` fixture schema, added guard coverage for the
  fixture corpus, defined the missing footprint create-slot and update Law IR
  shapes, and normalized scalar/explain-command spelling in the design packet.
- **Retired package reappearance guard**: `cargo xtask docs-check` now fails if
  a package listed under `retiredPackages` quietly returns with a `package.json`.
- **SHIPME fixture workflow trigger**: `cert-shipme.yml` now runs when
  `scripts/prepare-shipme-cert-fixture.mjs` changes, so certificate fixture
  regressions cannot bypass the SHIPME CI signal through path filtering.
- **Node retirement doc guard errors**: missing or unreadable
  `frontDoorDocs` entries now fail `cargo xtask docs-check` as Node retirement
  ledger check failures instead of CLI usage errors.
- **Node retirement validation map**: `docs/END_TO_END.md` now routes the Node
  retirement ledger guard through Rust preflight, matching the actual
  `cargo xtask docs-check` ownership.
- **Normalized SDL enum literals**: `normalize_schema_sdl` now renders schema
  enum defaults and directive enum arguments as GraphQL enum literals while
  preserving string literals that happen to share enum-like names.
- **Rust IR performance process bounds**: `pnpm perf:ir` now wraps Rust lowerer
  and Git metadata probes in `@git-stunts/alfred` timeouts with explicit output
  buffers so hung or oversized child processes produce controlled evidence
  instead of blocking CI.
- **IR parity process bounds**: `pnpm parity:ir` now uses the shared
  `@git-stunts/alfred` child-process runner for Rust lowerer, Rust hash, and
  Git metadata probes, giving the parity sentinel timeout and output-buffer
  controls that are covered by deterministic `TestClock` tests.
- **Rust IR performance baseline median**: Even-sized duration sample sets now
  report median as the rounded midpoint of the two central values instead of
  the upper middle sample.
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
  directive values as ordered arrays instead of overwriting earlier occurrences
  or re-sorting same-name directive instances.
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

## Initial public repository layout - 2025-09-01

- Initial public repository layout

[Unreleased]: https://github.com/flyingrobots/wesley/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/flyingrobots/wesley/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/flyingrobots/wesley/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/flyingrobots/wesley/compare/v0.0.5...v0.1.0
[0.0.5]: https://github.com/flyingrobots/wesley/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/flyingrobots/wesley/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/flyingrobots/wesley/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/flyingrobots/wesley/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/flyingrobots/wesley/releases/tag/v0.0.1
