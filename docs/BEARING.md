# BEARING

<!-- docs-truth: status=experimental owner=@flyingrobots -->

Current direction and active tensions. Historical ship data is in
`CHANGELOG.md`.

```mermaid
timeline
    Phase 1 : v0.0.5 Shipped : Clean House : Domain-Empty Backlog
    Phase 2 : v0.0.6 : Rust IR Parity : Boundary Proof
    Phase 3 : Binding Observatory : Module Runtime : Artifact Evidence
    Phase 4 : Legacy Node Retired : Rust-Native Release : Holmes Assurance
    Phase 5 : weslaw : Semantic Law IR : Contract Bundle Physics
```

## Active Gravity

### 1. Rust-Native Compiler Spine

The legacy Node compiler surface is retired. The current Wesley product spine is
the Rust workspace: `crates/wesley-core`, `crates/wesley-cli`, retained emitters,
Rust L1 fixtures, and `cargo xtask` verification.

Wesley should now behave like a normal Rust-native compiler project with
JavaScript only where it has an explicit non-compiler owner: Holmes assurance,
website/docs tooling, and browser/Bun/Deno host experiments.

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

### 4. Parity Sentinel Archive

`pnpm fixtures:ir` regenerates Rust L1 golden files. Rust fixture truth and
native self-consistency are now the product release gate.

The JS/Rust parity sentinel work remains useful as historical migration
evidence, but it is no longer the release oracle and the parity scripts are
gone. Current authority lives in Rust tests, Rust L1 goldens, native CLI
behavior, and
[the `0017` parity sentinel archive](./design/0017-rust-native-front-door-and-node-retirement/PARITY_SENTINEL_ARCHIVE.md).

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

### 7. Rust Core Binding Observatory Archive

- The binding observatory remains design evidence, not an active release gate.
- Do not resurrect the legacy JS lowerer just to compare timings. Future N-API,
  WASM, or external process bindings need fresh Rust-native evidence.
- Keep Rust CLI, Node binding, and WASM binding as separate adapter dimensions
  instead of collapsing them into one timing number.
- [0016-rust-core-binding-observatory](./design/0016-rust-core-binding-observatory/rust-core-binding-observatory.md)
  is archived runway context.

### 8. Wesley-Postgres Preservation

`wesley-postgres` is the PostgreSQL-family extraction home. It is active and
must not be abandoned while Wesley tightens its domain-empty boundary.

That repo remains the home for PostgreSQL/Supabase generation, PostgreSQL
execution adapters, and database safety primitives. Wesley should coordinate
by preserving generic module seams and avoiding new database semantics in the
base platform.

### 9. Legacy Node Retirement Campaign Closeout

The long-term target is met: no legacy Node authority remains in Wesley's
compiler, runtime, product entrypoint, tests, CI posture, or active release
plan. JavaScript remains only where a surface is explicitly classified outside
compiler authority: Holmes assurance, external host smoke experiments, website
tooling, docs tooling, and small repository automation.

Working budget: **96 slices**. The first ten slices establish the Rust-native
front door and retirement ledger. Later slices should retire Node by capability,
not by deleting files before equivalent Rust truth or explicit extraction
exists.

Status: **96 / 96 slices closed**. `packages/wesley-core`,
`packages/wesley-cli`, `packages/wesley-host-node`, and
`packages/wesley-runtime-node` are deleted. Holmes is self-contained. Browser,
Bun, and Deno host packages no longer import the retired JS core or runtime.
The closeout lives in
[FINAL_CLOSEOUT.md](./design/0017-rust-native-front-door-and-node-retirement/FINAL_CLOSEOUT.md).

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
- [x] NR-021 Port the remaining useful generic TypeScript emitter parity cases
      into `crates/wesley-emit-typescript`.
- [x] NR-022 Add TypeScript emitter golden fixtures for operation request and
      response bindings.
- [x] NR-023 Decide whether Zod emission remains generic Wesley or moves to an
      external module.
- [x] NR-024 If retained, add a Rust Zod emitter crate or module boundary
      (closed by the non-retention decision; no core Zod crate added).
- [x] NR-025 If extracted, move Zod retirement to the owning module/package
      plan and stop presenting it as core Wesley.
- [x] NR-026 Replace legacy `generate` docs with explicit Rust `emit` command
      docs where parity exists.
- [x] NR-027 Add native `wesley emit` metadata that records schema hash,
      generator version, and execution mode.
- [x] NR-028 Add Rust emitter fixtures proving no domain-specific Postgres,
      Echo, or jedit semantics leak into generic output.
- [x] NR-029 Port or retire legacy `models` command behavior.
- [x] NR-030 Port or retire legacy `init` command behavior.
- [x] NR-031 Port a narrow Rust `doctor` command only for Rust-native health
      checks.
- [x] NR-032 Extract certificate creation/signing/verification commands from the
      compiler front door.
- [x] NR-033 Extract Holmes/Moriarty evidence commands or re-home them under an
      explicit assurance package boundary.
- [x] NR-034 Decide whether runtime run ledger inspection remains in Wesley or
      exits with assurance tooling.
- [x] NR-035 Move package-level evidence tooling out of `packages/wesley-cli`
      or mark it compatibility-only.
- [x] NR-036 Replace Node dynamic module loading with a Rust-native target
      registry or external-process protocol design.
- [x] NR-037 Add Rust module target registry fixtures for no-module, default
      target, explicit target, and duplicate target behavior.
- [x] NR-038 Add Rust module capability metadata for execution mode and
      portability floor.
- [x] NR-039 Add a Rust capability report that names requested, granted, and
      denied capabilities.
- [x] NR-040 Add deny-by-default host-function governance for WASM module
      execution.
- [x] NR-041 Add WASM fixture rejection before execution when a module requests
      unavailable host imports.
- [x] NR-042 Add capability versioning diagnostics for incompatible module
      contracts.
- [x] NR-043 Define the stateless default runtime model and future resource
      handle boundary.
- [x] NR-044 Add Rust-native fixture modules for hermetic cross-host capability
      tests.
- [x] NR-045 Move browser/Bun/Deno host experiments out of the core retirement
      path or classify them as external ecosystem packages.
- [x] NR-046 Delete or externalize `packages/wesley-host-bun` after its
      compatibility evidence is obsolete.
- [x] NR-047 Delete or externalize `packages/wesley-host-deno` after its
      compatibility evidence is obsolete.
- [x] NR-048 Delete or externalize `packages/wesley-host-browser` after its
      compatibility evidence is obsolete.
- [x] NR-049 Replace `packages/wesley-host-node/bin/wesley.mjs` test invocations
      with native CLI invocations wherever tests are not explicitly legacy tests.
- [x] NR-050 Move remaining Node-host tests into a compatibility-only lane.
- [x] NR-051 Add CI labels or job names that distinguish Rust product checks
      from external host experiment checks.
- [x] NR-052 Make `cargo xtask preflight` the ordinary product health check.
- [x] NR-053 Make `cargo xtask legacy-preflight` optional for legacy package
      changes only.
- [x] NR-054 Remove docs command drift checks that treat Node CLI commands as
      primary truth.
- [x] NR-055 Replace Node-based schema diff references with native `wesley
schema diff` references.
- [x] NR-056 Replace Node-based schema hash references with native `wesley
schema hash` references.
- [x] NR-057 Replace Node-based lowerer references with native `wesley schema
lower` references.
- [x] NR-058 Replace Node generator examples with Rust emitter examples where
      parity exists.
- [x] NR-059 Add migration notes for users still calling `pnpm wesley`.
- [x] NR-060 Add deprecation warnings to legacy Node commands that have Rust
      replacements.
- [x] NR-061 Add package metadata warnings for legacy Node packages.
- [x] NR-062 Stop publishing or presenting legacy packages as product-front-door
      artifacts.
- [x] NR-063 Add release checklist entries for Rust crate/package publication
      without npm authority.
- [x] NR-064 Add a compatibility matrix that names each remaining legacy package
      and its retirement gate.
- [x] NR-065 Remove stale `runtime-node` product claims from README and package
      docs.
- [x] NR-066 Remove stale `host-node` product claims from README and package
      docs.
- [x] NR-067 Remove stale generator product claims from README and package docs
      once Rust emitters cover the useful generic surface.
- [x] NR-068 Remove stale Holmes-as-core claims from docs once assurance is
      extracted or isolated.
- [x] NR-069 Update `docs/END_TO_END.md` so the Rust-native pipeline is the
      first and only product spine.
- [x] NR-070 Update `docs/ARCHITECTURE.md` so packages are compatibility
      appendices, not system center.
- [x] NR-071 Update `docs/GUIDE.md` so `cargo wesley` and `cargo xtask` are the
      normal path.
- [x] NR-072 Update `docs/ENTRYPOINTS.md` after each command retirement.
- [x] NR-073 Remove closed-gate legacy Node command references from public docs.
- [x] NR-074 Replace JS lowerer parity as a release gate with Rust
      self-consistency and fixture truth while retaining parity scripts as
      migration-only evidence.
- [x] NR-075 Archive JS/Rust parity sentinel reports as historical evidence
      instead of active authority.
- [x] NR-076 Delete `packages/wesley-core` after generic useful behavior is
      ported, extracted, or explicitly rejected.
- [x] NR-077 Delete `packages/wesley-cli` after commands are ported, extracted,
      or explicitly rejected.
- [x] NR-078 Delete `packages/wesley-host-node` after no product/test path uses
      the Node executable wrapper.
- [x] NR-079 Delete `packages/wesley-runtime-node` after module loading and
      runtime evidence no longer depend on it.
- [x] NR-080 Delete or externalize `packages/wesley-generator-js`.
- [x] NR-081 Delete or externalize `packages/wesley-generator-vue`.
- [x] NR-082 Delete or externalize `packages/wesley-scaffold-multitenant`.
- [x] NR-083 Delete or replace `packages/wesley-test-fixtures`.
- [x] NR-084 Delete or externalize `packages/wesley-tasks`.
- [x] NR-085 Remove package workspace entries for deleted legacy packages.
- [x] NR-086 Remove package scripts that only support deleted legacy packages.
- [x] NR-087 Remove lockfile dependency families that exist only for deleted
      legacy packages.
- [x] NR-088 Remove GitHub Actions jobs that exist only for deleted legacy
      packages.
- [x] NR-089 Preserve website/docs tooling separately if JavaScript remains
      useful outside product authority.
- [x] NR-090 Preserve `@git-stunts/alfred` only for JavaScript tooling seams
      that still need bounded child-process behavior.
- [x] NR-091 Preserve `ninelives` as the Rust resilience policy primitive for
      compiler and capability seams.
- [x] NR-092 Run a repo-wide stale Node shadow audit after deletions.
- [x] NR-093 Run a docs link/truth audit after deletions.
- [x] NR-094 Run a CI/release dry-run proving Rust-only product release does not
      require legacy Node packages.
- [x] NR-095 Publish the final legacy Node retirement closeout with migrated,
      extracted, deleted, deferred, and rejected surfaces.
- [x] NR-096 Remove the campaign from active `BEARING` once the closeout is
      merged and only normal maintenance remains.

### 10. Holmes Assurance Hexagon

Holmes should be redesigned as a Rust-native assurance hexagon, not ported as a
JavaScript-shaped crate. The new design lives in
[0018-holmes-assurance-hexagon](./design/0018-holmes-assurance-hexagon/holmes-assurance-hexagon.md).

The target shape is one assurance core with three interfaces: CLI, API, and
MCP. Reporting is an abstraction over a structured `ReportDocument`; GitHub PR
comments are one publisher, not the architecture. The JavaScript Holmes package
no longer blocks legacy core/runtime deletion, but it is still a transitional
assurance surface.

### 11. weslaw Semantic Law IR

The next architectural move is `weslaw`: a first-class semantic law layer for
Wesley contract bundles. GraphQL SDL remains sovereign over structural shape.
`weslaw` becomes sovereign over semantic law. The combined, bound, canonical
contract bundle is the unit Wesley hashes, diffs, emits, explains, validates,
and hands to assurance tools.

The formal design lives in
[0019-weslaw-semantic-law-ir](./design/0019-weslaw-semantic-law-ir/weslaw-semantic-law-ir.md).

The non-negotiables are narrow:

- Law IR is the product; YAML, directives, and future SDL+ are frontends.
- Active law binds strictly to schema coordinates and explicit law registries.
- Law documents anchor to canonical schema hashes.
- Law IR and authoring documents publish versioned machine-readable schemas.
- Semantic hashes are computed from normalized Law IR, not authored bytes.
- Machine-readable law diffs are first-class outputs.
- Policy, evidence, and judgment remain separate from semantic law.
- Wesley SDL+ is deferred until Law IR, binding, canonicalization, and diffs
  are stable.

Working budget: **75 slices**. The first scope checkpoint was `WLAW-050`; it
kept the runway intact. The second checkpoint at `WLAW-069` confirms the
adoption tooling is now usable enough to start the first consumer payoff pull.

Status: **69 / 75 slices closed**. `WLAW-001` through `WLAW-010` lock the v1
substrate docs, coordinate and registry grammar, canonicalization and
diagnostic rules, fixture corpus, and first accepted/rejected `weslaw/v1`
examples. `WLAW-011` through `WLAW-020` add the Rust Law IR v1 types, the
`weslaw/v1` YAML structure loader, stable structure diagnostics, fixture
lowering tests, and versioned canonical JSON Schema artifacts for the authored
and normalized law surfaces. `WLAW-021` through `WLAW-035` add strict
schema-hash anchoring, schema and operation subject binding, kind-specific
variant/footprint/channel/invariant reference binding, conflict diagnostics,
closest-match subject hints, and the explicit `wesley law validate` command.
`WLAW-036` through `WLAW-045` add canonical semantic Law IR serialization,
`lawHash`, provenance-bearing `lawDocumentHash`, empty-profile `profileHash`,
contract `bundleHash`, a versioned contract bundle manifest schema, manifest
output from `wesley law validate --json`, `--law`-backed emit metadata, and Rust
generated hash constants. `WLAW-046` through `WLAW-050` add
`wesley.law-diff/v1`, Rust-core semantic diff reports, added/removed law
events, scalar semantic change events, variant case change events, footprint
expansion/contraction/mixed-change events, and the first checkpoint on the
remaining runway. `WLAW-051` through `WLAW-059` add channel law and typed
invariant diff events, strengthened/weakened law classifications,
binding-break and schema-hash rebound reporting, `wesley law diff --json`,
Markdown summaries, CI-ready semantic diff fixtures, Holmes/BLADE-facing
fixtures, and the matching docs/changelog update. `WLAW-060` through
`WLAW-069` add `@wes_channel` directive lowering, directive/YAML canonical
equivalence tests, `wesley law lint`, `wesley init-law`, description-derived
draft suggestions, `wesley law explain` for scalar and operation subjects,
explicit `wesley law rebind` reporting and acceptance, and updated adoption
docs.

## Tensions

- **Rust Native Discipline**: The easy mistake after deletion is to recreate
  the old JavaScript surface through scripts, docs, or compatibility shortcuts.
  New compiler behavior belongs in Rust crates unless there is an explicit
  non-compiler owner.
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
- **Law Versus Runtime Meaning**: `weslaw` lets Wesley preserve and reason
  about semantic law, but Echo, Continuum, jedit, warp-ttd, and
  `wesley-postgres` still own target meaning and runtime behavior.
- **Law IR Scope Control**: The first `weslaw` implementation must stay typed,
  deterministic, and boring. It must not become an expression language, policy
  engine, or YAML programming language.

## Next Target

The immediate focus is **finishing the `weslaw` v1 consumer payoff and packet
closeout**.

Current evidence still includes complete v0.0.5 publication proof, Rust L1
fixtures for directive-heavy SDL, schema extensions, nested list type
references, legacy aliases, invalid duplicate-directive coverage, parser parity
acceptance evidence, IR parity projections, Rust CLI performance baselines,
module-target dispatch coverage, the `0014` domain-empty boundary, the `0015`
resilience boundary, and the `0016` binding observatory archive. Those remain
historical proof floor. The `0017` packet now closes the retirement campaign.
The `0018` packet names the assurance architecture that lets Holmes mature
without pinning Wesley to legacy Node. The `0019` packet names the semantic law
architecture that lets Wesley compile meaning alongside shape without smuggling
runtime ownership into the base compiler.

The next pull after this PR is:

1. `WLAW-070` through `WLAW-075`: deliver the first consumer payoff, make the
   coverage/Law Matrix call, and close the v1 packet with playback evidence.

## Post-Retirement Freestyle Slice Log

These celebration slices are not a new campaign. They are cleanup ballast after
the 96-slice retirement closeout.

- [x] PF-001 Remove the remaining `HOST=node` host-contract entrypoint and make
      retained host-contract runs opt into `browser`, `deno`, or `bun`.
- [x] PF-002 Rename live host-check doctrine from `Legacy Compatibility` to
      `External Host Experiment`.
- [x] PF-003 Add a Rust `xtask` guard that fails when a package listed in
      `retiredPackages` quietly reappears with a `package.json`.
- [x] PF-004 Refresh CI, host, and script docs so post-retirement operators see
      product checks, repo hygiene, and external host experiments as separate
      lanes.
- [x] PF-005 Record the post-retirement cleanup in the changelog so the branch
      tells the whole story after merge.

The `ninelives` decision is made: use `ninelives` for Rust resilience seams and
Alfred for JavaScript tooling seams. Keep the scope narrow: resilience policy
wraps execution boundaries; it does not import product, database, scheduler, or
runtime semantics into Wesley.

The Node binding decision is intentionally not made yet. The current posture is
Rust CLI as the authoritative native compiler path and fresh observatory
evidence before any N-API or WASM production binding choice.

Echo and jedit do not need more Wesley feature gravity for their current work.
Wesley should coordinate on compatibility only when a concrete artifact, hash,
or generated-surface change requires it.
