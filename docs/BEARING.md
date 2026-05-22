# BEARING
<!-- docs-truth: status=experimental owner=@flyingrobots -->

Current direction and active tensions. Historical ship data is in
`CHANGELOG.md`.

```mermaid
timeline
    Phase 1 : v0.0.5 Shipped : Clean House : Domain-Empty Backlog
    Phase 2 : v0.0.6 : Rust IR Parity : Fixture Truth
    Phase 3 : Module Boundary : External Targets : Artifact Evidence
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
- **External Module Gap**: Wesley can name the domain-empty boundary, but
  external modules still need enough capability runtime and artifact evidence
  to consume it cleanly.
- **Sibling Repo Coordination**: Wesley should reference `wesley-postgres` as
  the database authority without editing or overwriting sibling work from this
  repo.

## Next Target

The immediate focus is **v0.0.6 Rust IR parity and module-boundary
enforcement**:

Current evidence now includes complete v0.0.5 publication proof, an expanded
Rust L1 corpus for directive-heavy SDL, schema extensions, legacy aliases, and
invalid duplicate-directive coverage, plus `pnpm parity:ir` for the
`js-table-vs-rust-table.v0` compatibility projection over the first
table-compatible sentinel corpus.

The next pulls are:

1. Land domain-empty core boundary enforcement so product and database behavior
   stays outside generic Wesley. The active packet is
   [0014-domain-empty-core-boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md).
2. Broaden parity sentinel coverage only after naming fair projections for
   non-table extension semantics and scale/performance fixtures.
3. Continue the IR contract fixture lane for stable invalid-SDL diagnostics,
   including codes and spans where available.
4. Keep `wesley-postgres` visible as the database extraction home and avoid
   reshaping sibling work from Wesley release branches.
5. Use the parity sentinel output as compatibility evidence before retiring or
   demoting legacy Node lowering.

Echo and jedit do not need more Wesley feature gravity for their current work.
Wesley should coordinate on compatibility only when a concrete artifact, hash,
or generated-surface change requires it.
