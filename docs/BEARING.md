# BEARING
<!-- docs-truth: status=experimental owner=@flyingrobots -->

Current direction and active tensions. Historical ship data is in
`CHANGELOG.md`.

```mermaid
timeline
    Phase 1 : v0.0.5 Shipped : Clean House : Domain-Empty Backlog
    Phase 2 : v0.0.6 : Rust IR Parity : Boundary Proof
    Phase 3 : Module Runtime : External Targets : Artifact Evidence
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

### 5. Module Capability Boundary

- Use the module capability registry as the seam between loaded modules and
  Wesley base verbs.
- Keep `wesley compile` dispatching only through module-owned `wesley.targets`.
- Keep Wesley core CI independent of external product and database repos by
  exercising hermetic fixture modules across supported capability collections.
- Move product/runtime/database semantics to owning repos or modules before
  deleting generic compatibility evidence that external consumers still need.

### 6. Wesley-Postgres Preservation

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
- **Invalid Diagnostics**: The Rust lowerer can reject invalid SDL, but stable
  codes and spans are not yet part of the L1 fixture contract.
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
Rust L1 corpus for directive-heavy SDL, schema extensions, legacy aliases, and
invalid duplicate-directive coverage, `pnpm parity:ir` for the
`js-table-vs-rust-table.v0` compatibility projection over the first
table-compatible sentinel corpus, the domain-empty ownership packet in `0014`,
and executable module-target dispatch coverage for no-module diagnostics,
default target discovery, requested-target validation, duplicate target
rejection, and alias conflicts in both registration orders.

The next pulls are:

1. Expand the fixture-module zoo only where it adds new boundary evidence:
   target dispatch already rejects missing modules, invalid product/database
   target names, duplicate names, and aliases that collide before or after the
   owning target loads.
2. Pull the remaining Rust IR contract fixture card into design so fixture
   classes, canonical byte rules, diagnostics, and performance evidence are
   release-scoped instead of floating in `asap/`.
3. Stabilize invalid-SDL diagnostic contracts with executable coverage for
   codes and spans where available, while naming what remains intentionally
   unstable.
4. Define the next parity projection before broadening `pnpm parity:ir` beyond
   table-compatible SDL. Schema extensions and non-table L1 facts need a fair
   projection before they become JS/Rust parity evidence.
5. Capture a Rust core performance baseline over the canonical corpus after
   the fixture and projection boundaries are named.

Do not pull `OWN_ninelives-resilience-integration.md` until the module boundary
has stronger executable evidence. Resilience policy should not arrive before
the base compiler/module seam is boring.

Echo and jedit do not need more Wesley feature gravity for their current work.
Wesley should coordinate on compatibility only when a concrete artifact, hash,
or generated-surface change requires it.
