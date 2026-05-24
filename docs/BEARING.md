# BEARING

<!-- docs-truth: status=experimental owner=@flyingrobots -->

Current direction and active tensions. Historical ship data is in
`CHANGELOG.md`.

```mermaid
timeline
    Phase 1 : v0.0.5 Shipped : Clean House : Domain-Empty Backlog
    Phase 2 : v0.0.6 : Rust IR Parity : Boundary Proof
    Phase 3 : Binding Observatory : Module Runtime : Artifact Evidence
    Phase 4 : Core Release : Legacy Node Retirement : Postgres Module Cutover
```

## Active Gravity

### 1. v0.0.6 Rust IR Parity

The next Wesley hill is not another product lane. It is a compiler-truth
release that makes the Rust core harder to drift from the legacy JS lowering
surface while Wesley finishes moving toward one native compiler brain.

v0.0.5 closed the clean-house release. v0.0.6 should turn that cleanup into
evidence: richer canonical fixtures, clearer compatibility diagnostics, and a
separate JS/Rust parity sentinel that proves whether current Rust L1 bytes
still match the legacy truth anchors where they are expected to match.

### 2. Domain-Empty Core

- Wesley's identity is the core `GraphQL -> whatever` compiler and assurance
  toolchain.
- The `whatever` must come from explicitly loaded external modules, not
  built-in product or database semantics.
- [0014-domain-empty-core-boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)
  is now the active ownership doctrine, not a pending cleanup card.
- Echo, jedit, Continuum, WARPspace, and `warp-ttd` behavior belongs in the
  owning repos or owning modules.
- PostgreSQL/Supabase behavior belongs in `wesley-postgres`, not in
  `wesley-core`, Wesley generators, generic host packages, or generic task
  execution packages.

### 3. Rust L1 Fixture Truth

- Treat the Rust workspace as the primary compiler surface.
- Expand the canonical fixture corpus before broad rewrites.
- Keep nondeterministic metadata out of parity-sensitive IR bytes.
- Preserve directive spelling, alias normalization, extension folding, and
  invalid-SDL diagnostics as explicit tests instead of tribal knowledge.
- Keep jedit-shaped consumer fixtures as compiler coverage, not as jedit
  product ownership.

### 4. Parity Sentinel Before Retirement

`pnpm fixtures:ir` regenerates Rust L1 golden files. It is not JS/Rust parity
proof.

The new sentinel work lives in
[0013-rust-ir-parity-sentinel](./design/0013-rust-ir-parity-sentinel/rust-ir-parity-sentinel.md).
It should compare normalized semantic IR from the legacy JS lowerer and the
Rust lowerer over an explicit corpus, then fail with a useful mismatch path and
hash evidence. Only after that evidence exists should Wesley retire or demote
legacy Node lowering.

### 5. Resilience Policy Boundary

- Use `ninelives` for Rust compiler and capability seams when a boundary needs
  explicit cooperative resilience policy.
- Use `@git-stunts/alfred` for JavaScript tooling and child-process boundaries
  when a command can hang or emit unbounded output.
- Keep deterministic compiler errors as compiler errors; do not retry semantic
  parse/lowering failures.
- Do not imply hard preemption for synchronous in-process parser work; use a
  process, thread, or runtime boundary when a lowerer needs a hard deadline.
- [0015-resilience-policy-boundary](./design/0015-resilience-policy-boundary/resilience-policy-boundary.md)
  is now the active resilience doctrine.

### 6. Module Capability Boundary

- Use the module capability registry as the seam between loaded modules and
  Wesley base verbs.
- Keep `wesley compile` dispatching only through module-owned `wesley.targets`.
- Keep Wesley core CI independent of external product and database repos by
  exercising hermetic fixture modules across supported capability collections.
- Move product/runtime/database semantics to owning repos or modules before
  deleting generic compatibility evidence that external consumers still need.

### 7. Rust Core Binding Observatory

- `pnpm perf:bindings` is now the evidence seam for Node/Rust/WASM cutover
  planning.
- Keep Rust CLI, legacy JS, Node binding, and WASM binding as separate adapter
  dimensions instead of collapsing them into one timing number.
- Treat `node-rust-binding` and `wasm-binding` as explicit `not-implemented`
  report slots until real adapters exist.
- Do not choose N-API, WASM, or legacy JS retirement from performance vibes.
  Cutover needs correctness parity, latency, memory, binding overhead, and
  normal CLI regression evidence.
- [0016-rust-core-binding-observatory](./design/0016-rust-core-binding-observatory/rust-core-binding-observatory.md)
  is now the active Phase 3 runway packet.

### 8. Wesley-Postgres Preservation

`wesley-postgres` is the PostgreSQL-family extraction home. It is active and
must not be abandoned while Wesley tightens its domain-empty boundary.

That repo remains the home for PostgreSQL/Supabase generation, PostgreSQL
execution adapters, and database safety primitives. Wesley should coordinate
by preserving generic module seams and avoiding new database semantics in the
base platform.

### 9. Legacy Node Retirement Campaign

The long-term target is no legacy Node authority in Wesley's compiler,
runtime, product entrypoint, docs, tests, or release posture. JavaScript may
remain only when a surface is explicitly classified as compatibility evidence,
external ecosystem support, website/docs tooling, or a temporary migration
harness.

Working budget: **96 slices**. The first ten slices establish the Rust-native
front door and retirement ledger. Later slices should retire Node by capability,
not by deleting files before equivalent Rust truth or explicit extraction
exists.

- [x] NR-001 Reset `BEARING` around the 96-slice legacy Node retirement
  campaign.
- [x] NR-002 Open design packet `0017` for the Rust-native front door and Node
  retirement doctrine.
- [x] NR-003 Promote the Node retirement ledger as the authoritative inventory
  for product, runtime, tooling, and shadow surfaces.
- [x] NR-004 Record `apollo-parser` as the Rust parser choice for the retirement
  runway.
- [x] NR-005 Classify current Node packages and command surfaces by port,
  extract, delete, or defer disposition.
- [x] NR-006 Add a Rust-core SDL normalization API that renders consolidated
  compiler facts.
- [x] NR-007 Expose `wesley normalize-sdl --schema <path>` from the native CLI.
- [x] NR-008 Add golden normalized-SDL fixtures for extension folding, sorting,
  argument defaults, unions, and nested list references.
- [x] NR-009 Update front-door docs so Rust normalization is visible from the
  native command map.
- [x] NR-010 Reconcile pulled backlog cards into packet `0017`, docs, and
  changelog.
- [x] NR-011 Add a machine-readable Node retirement ledger export for CI and
  review automation.
- [x] NR-012 Add a drift check that fails when a new Node package appears
  without a ledger disposition.
- [x] NR-013 Add a drift check that fails when docs introduce `pnpm wesley` as a
  primary product front door.
- [x] NR-014 Add a drift check that fails when `packages/wesley-core` gains new
  compiler authority without a Rust counterpart.
- [x] NR-015 Add Rust normalizer coverage for directive aliases and repeated
  custom directives.
- [x] NR-016 Add Rust normalizer coverage for descriptions and escaped string
  values.
- [x] NR-017 Add Rust normalizer coverage for input object defaults and nested
  object directive arguments.
- [x] NR-018 Publish normalized SDL hash evidence beside L1 IR hash evidence.
- [x] NR-019 Add a Rust parser diagnostics fixture corpus for syntax,
  duplicate-directive, and semantic lowering failures.
- [x] NR-020 Update parser parity output to reference Rust normalized SDL where
  useful.
- [ ] NR-021 Port the remaining useful generic TypeScript emitter parity cases
  into `crates/wesley-emit-typescript`.
- [ ] NR-022 Add TypeScript emitter golden fixtures for operation request and
  response bindings.
- [ ] NR-023 Decide whether Zod emission remains generic Wesley or moves to an
  external module.
- [ ] NR-024 If retained, add a Rust Zod emitter crate or module boundary.
- [ ] NR-025 If extracted, move Zod retirement to the owning module/package
  plan and stop presenting it as core Wesley.
- [ ] NR-026 Replace legacy `generate` docs with explicit Rust `emit` command
  docs where parity exists.
- [ ] NR-027 Add native `wesley emit` metadata that records schema hash,
  generator version, and execution mode.
- [ ] NR-028 Add Rust emitter fixtures proving no domain-specific Postgres,
  Echo, or jedit semantics leak into generic output.
- [ ] NR-029 Port or retire legacy `models` command behavior.
- [ ] NR-030 Port or retire legacy `init` command behavior.
- [ ] NR-031 Port a narrow Rust `doctor` command only for Rust-native health
  checks.
- [ ] NR-032 Extract certificate creation/signing/verification commands from the
  compiler front door.
- [ ] NR-033 Extract Holmes/Moriarty evidence commands or re-home them under an
  explicit assurance package boundary.
- [ ] NR-034 Decide whether runtime run ledger inspection remains in Wesley or
  exits with assurance tooling.
- [ ] NR-035 Move package-level evidence tooling out of `packages/wesley-cli`
  or mark it compatibility-only.
- [ ] NR-036 Replace Node dynamic module loading with a Rust-native target
  registry or external-process protocol design.
- [ ] NR-037 Add Rust module target registry fixtures for no-module, default
  target, explicit target, and duplicate target behavior.
- [ ] NR-038 Add Rust module capability metadata for execution mode and
  portability floor.
- [ ] NR-039 Add a Rust capability report that names requested, granted, and
  denied capabilities.
- [ ] NR-040 Add deny-by-default host-function governance for WASM module
  execution.
- [ ] NR-041 Add WASM fixture rejection before execution when a module requests
  unavailable host imports.
- [ ] NR-042 Add capability versioning diagnostics for incompatible module
  contracts.
- [ ] NR-043 Define the stateless default runtime model and future resource
  handle boundary.
- [ ] NR-044 Add Rust-native fixture modules for hermetic cross-host capability
  tests.
- [ ] NR-045 Move browser/Bun/Deno host experiments out of the core retirement
  path or classify them as external ecosystem packages.
- [ ] NR-046 Delete or externalize `packages/wesley-host-bun` after its
  compatibility evidence is obsolete.
- [ ] NR-047 Delete or externalize `packages/wesley-host-deno` after its
  compatibility evidence is obsolete.
- [ ] NR-048 Delete or externalize `packages/wesley-host-browser` after its
  compatibility evidence is obsolete.
- [ ] NR-049 Replace `packages/wesley-host-node/bin/wesley.mjs` test invocations
  with native CLI invocations wherever tests are not explicitly legacy tests.
- [ ] NR-050 Move remaining Node-host tests into a compatibility-only lane.
- [ ] NR-051 Add CI labels or job names that distinguish Rust product checks
  from legacy compatibility checks.
- [ ] NR-052 Make `cargo xtask preflight` the ordinary product health check.
- [ ] NR-053 Make `cargo xtask legacy-preflight` optional for legacy package
  changes only.
- [ ] NR-054 Remove docs command drift checks that treat Node CLI commands as
  primary truth.
- [ ] NR-055 Replace Node-based schema diff references with native `wesley
  schema diff` references.
- [ ] NR-056 Replace Node-based schema hash references with native `wesley
  schema hash` references.
- [ ] NR-057 Replace Node-based lowerer references with native `wesley schema
  lower` references.
- [ ] NR-058 Replace Node generator examples with Rust emitter examples where
  parity exists.
- [ ] NR-059 Add migration notes for users still calling `pnpm wesley`.
- [ ] NR-060 Add deprecation warnings to legacy Node commands that have Rust
  replacements.
- [ ] NR-061 Add package metadata warnings for legacy Node packages.
- [ ] NR-062 Stop publishing or presenting legacy packages as product-front-door
  artifacts.
- [ ] NR-063 Add release checklist entries for Rust crate/package publication
  without npm authority.
- [ ] NR-064 Add a compatibility matrix that names each remaining legacy package
  and its retirement gate.
- [ ] NR-065 Remove stale `runtime-node` product claims from README and package
  docs.
- [ ] NR-066 Remove stale `host-node` product claims from README and package
  docs.
- [ ] NR-067 Remove stale generator product claims from README and package docs
  once Rust emitters cover the useful generic surface.
- [ ] NR-068 Remove stale Holmes-as-core claims from docs once assurance is
  extracted or isolated.
- [ ] NR-069 Update `docs/END_TO_END.md` so the Rust-native pipeline is the
  first and only product spine.
- [ ] NR-070 Update `docs/ARCHITECTURE.md` so packages are compatibility
  appendices, not system center.
- [ ] NR-071 Update `docs/GUIDE.md` so `cargo wesley` and `cargo xtask` are the
  normal path.
- [ ] NR-072 Update `docs/ENTRYPOINTS.md` after each command retirement.
- [ ] NR-073 Remove legacy Node command references from public docs once their
  migration gates close.
- [ ] NR-074 Replace JS lowerer parity as a release gate with Rust
  self-consistency and fixture truth once migration is complete.
- [ ] NR-075 Archive JS/Rust parity sentinel reports as historical evidence
  instead of active authority.
- [ ] NR-076 Delete `packages/wesley-core` after generic useful behavior is
  ported, extracted, or explicitly rejected.
- [ ] NR-077 Delete `packages/wesley-cli` after commands are ported, extracted,
  or explicitly rejected.
- [ ] NR-078 Delete `packages/wesley-host-node` after no product/test path uses
  the Node executable wrapper.
- [ ] NR-079 Delete `packages/wesley-runtime-node` after module loading and
  runtime evidence no longer depend on it.
- [ ] NR-080 Delete or externalize `packages/wesley-generator-js`.
- [ ] NR-081 Delete or externalize `packages/wesley-generator-vue`.
- [ ] NR-082 Delete or externalize `packages/wesley-scaffold-multitenant`.
- [ ] NR-083 Delete or replace `packages/wesley-test-fixtures`.
- [ ] NR-084 Delete or externalize `packages/wesley-tasks`.
- [ ] NR-085 Remove package workspace entries for deleted legacy packages.
- [ ] NR-086 Remove package scripts that only support deleted legacy packages.
- [ ] NR-087 Remove lockfile dependency families that exist only for deleted
  legacy packages.
- [ ] NR-088 Remove GitHub Actions jobs that exist only for deleted legacy
  packages.
- [ ] NR-089 Preserve website/docs tooling separately if JavaScript remains
  useful outside product authority.
- [ ] NR-090 Preserve `@git-stunts/alfred` only for JavaScript tooling seams
  that still need bounded child-process behavior.
- [ ] NR-091 Preserve `ninelives` as the Rust resilience policy primitive for
  compiler and capability seams.
- [ ] NR-092 Run a repo-wide stale Node shadow audit after deletions.
- [ ] NR-093 Run a docs link/truth audit after deletions.
- [ ] NR-094 Run a CI/release dry-run proving Rust-only product release does not
  require legacy Node packages.
- [ ] NR-095 Publish the final legacy Node retirement closeout with migrated,
  extracted, deleted, deferred, and rejected surfaces.
- [ ] NR-096 Remove the campaign from active `BEARING` once the closeout is
  merged and only normal maintenance remains.

## Tensions

- **Two-Brain Confusion**: Rust and Node surfaces still coexist. The intended
  shape is one compiler brain (`crates/wesley-core`), one native command body
  (`crates/wesley-cli`), and legacy Node support surfaces under `packages/`
  until ported, extracted, or retired.
- **Fixture Churn**: IR, hash, directive, or generated-artifact changes can
  affect Echo and jedit fixtures. Those changes need explicit compatibility
  notes rather than accidental hash churn.
- **Alias Semantics**: Legacy directive aliases are compatibility input, not a
  license to preserve arbitrary spelling in semantic Rust L1 output.
- **Invalid Diagnostics**: The Rust lowerer now exposes stable diagnostic
  codes and parser spans, but semantic lowering spans are still absent and
  should not be implied by tests or release notes.
- **External Module Gap**: Wesley has named the domain-empty boundary, but the
  module seam still needs hermetic target-dispatch fixtures, runtime boundary
  evidence, and artifact evidence before external modules can consume it
  cleanly.
- **Sibling Repo Coordination**: Wesley should reference `wesley-postgres` as
  the database authority without editing or overwriting sibling work from this
  repo.

## Next Target

The immediate focus is **Rust native front door and legacy Node retirement
runway**.

The v0.0.6 compiler-truth work still matters, but the long-term goal now makes
the priority sharper: Rust must become the normal way to inspect compiler
facts before Wesley deletes or demotes the historical Node surface. The first
ten retirement slices establish that posture through
[design packet `0017`](./design/0017-rust-native-front-door-and-node-retirement/rust-native-front-door-and-node-retirement.md),
the
[Node retirement ledger](./design/0017-rust-native-front-door-and-node-retirement/NODE_RETIREMENT_LEDGER.md),
and the native `wesley normalize-sdl --schema <path>` command.

Current evidence still includes complete v0.0.5 publication proof, Rust L1
fixtures for directive-heavy SDL, schema extensions, nested list type
references, legacy aliases, invalid duplicate-directive coverage, parser parity
acceptance evidence, IR parity projections, Rust CLI performance baselines,
module-target dispatch coverage, the `0014` domain-empty boundary, the `0015`
resilience boundary, and the `0016` binding observatory. Those remain the proof
floor. The new `0017` packet names the retirement campaign that decides what
all that proof is for.

The next pulls after this drift check are:

1. Port the remaining useful generic TypeScript emitter parity cases into
   `crates/wesley-emit-typescript`.
2. Add TypeScript emitter golden fixtures for operation request and response
   bindings.
3. Decide whether Zod emission remains generic Wesley or moves to an external
   module.
4. Continue moving command authority from legacy Node CLI paths to Rust-native
   `schema`, `emit`, `operation`, and future narrow `doctor` commands.
5. Keep WASM/module capability governance queued, but do it after the Rust
   native front door can explain compiler truth without Node.

The `ninelives` decision is made: use `ninelives` for Rust resilience seams and
Alfred for JavaScript tooling seams. Keep the scope narrow: resilience policy
wraps execution boundaries; it does not import product, database, scheduler, or
runtime semantics into Wesley.

The Node binding decision is intentionally not made yet. The current posture is
Rust CLI as the authoritative native compiler path, legacy JS as compatibility
fallback during parity migration, and observatory evidence before any N-API or
WASM production binding choice.

Echo and jedit do not need more Wesley feature gravity for their current work.
Wesley should coordinate on compatibility only when a concrete artifact, hash,
or generated-surface change requires it.
