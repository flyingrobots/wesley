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

The immediate focus is **v0.0.6 Rust IR parity and module-boundary
enforcement**:

Current evidence now includes complete v0.0.5 publication proof, an expanded
Rust L1 corpus for directive-heavy SDL, schema extensions, nested list type
references, legacy aliases, and invalid duplicate-directive coverage,
`pnpm parity:ir` for the
`js-table-vs-rust-table.v0` compatibility projection over the first
table-compatible sentinel corpus, `pnpm parity:ir` support for fixture-owned
projections, the `js-sdl-type-family-vs-rust-l1-type-family.v0` projection
over extension-folded SDL type-family facts and nested list wrapper facts,
default sentinel admission for `schema-extensions-schema.graphql` and
`nested-list-schema.graphql` under that projection, `pnpm parity:parser` parser
acceptance evidence over valid, syntax-invalid, and duplicate-directive
rejection fixtures, `pnpm perf:ir` Rust CLI wall-clock baseline evidence over the
valid IR fixture corpus, optional in-process legacy JS lowerer comparison via
`pnpm perf:ir -- --include-legacy-js`, the domain-empty ownership packet in
`0014`, and executable module-target dispatch coverage for no-module
diagnostics, default target discovery, requested-target validation, duplicate
target rejection, alias conflicts in both registration orders, multi-module
alias resolution, and schema-hash agreement across generated module targets.
The Rust IR fixture contract now lives under the active `0013` packet. The
`0015` resilience boundary now has first proof on both sides:
`ResilientLoweringPort` applies explicit cooperative `ninelives` timeout policy
for Rust lowering seams, while the parity and performance scripts share an
Alfred-backed child-process runner with timeout and output-buffer guards. The
Rust wrapper does not claim hard preemption for synchronous CPU-bound parser
work.
Invalid SDL diagnostics now expose stable `WesleyError::diagnostic()` codes
and parser line/column spans where available, while semantic lowering spans
remain explicitly absent.

The next pulls are:

1. Use `pnpm perf:bindings` to broaden performance evidence only where the
   report distinguishes Rust CLI, legacy JS, Node binding, WASM binding, and
   memory posture.
2. Add new parity fixtures only when they exercise a named projection boundary
   that the current table and type-family corpus does not already cover.
3. Move toward the Phase 3 module runtime runway through explicit adapter and
   capability evidence, not by importing product/runtime semantics into core.

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
