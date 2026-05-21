# BEARING
<!-- docs-truth: status=experimental owner=@flyingrobots -->

Current direction and active tensions. Historical ship data is in
`CHANGELOG.md`.

```mermaid
timeline
    Phase 1 : Clean House Release : Domain-Empty Core : Backlog Truth
    Phase 2 : IR Truth : Rust Parity : Stable Fixture Corpus
    Phase 3 : Module Boundaries : External Targets : Artifact Evidence
    Phase 4 : Core Release : Legacy Node Retirement : Postgres Module Cutover
```

## Active Gravity

### 1. Clean House Release

The next Wesley hill is an introspective cleanup release.

Wesley should stop orbiting old Echo, jedit, Continuum, PostgreSQL, and
Supabase implementation lanes. Those repos or their external module homes now
own the product/domain work. Wesley owns the compiler kernel, generic module
contracts, generic artifact/evidence plumbing, and compatibility evidence that
those external consumers can inspect.

The cleanup release should make the repository's backlog, docs, tests, and
front doors say that consistently.

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

### 3. IR Truth And Rust Parity

- Treat the Rust workspace as the primary compiler surface.
- Freeze the canonical IR contract and fixture corpus before broad rewrites.
- Remove nondeterministic metadata from parity-sensitive IR bytes.
- Keep a JS/Rust parity sentinel over canonical fixtures until legacy Node
  lowering is retired or deliberately demoted.
- Keep jedit-shaped consumer fixtures as compiler coverage, not as jedit
  product ownership.

### 4. External Optic Admission Split

The current optic-admission ownership split is:

- Wesley compiles artifacts and registration descriptors.
- Echo registers artifacts, returns runtime-local handles, admits or obstructs
  invocations, instruments access, and emits witnesses/readings.
- Authority layers issue grants and capability presentations.
- Applications hide artifact handles, basis references, and runtime
  coordinates behind product-facing adapters.
- Continuum coordinates the shared role map, but should not freeze a shared
  protocol family until the compiled-artifact, registration, invocation, and
  witness path is proven in the owning repos.

That split belongs in repo bearings and external backlogs, not as hidden Wesley
product work.

### 5. Module Capability Runtime

- Use the module capability registry as the seam between loaded modules and
  Wesley base verbs.
- Keep `wesley compile` dispatching only through module-owned `wesley.targets`.
- Keep Wesley core CI independent of external product and database repos by
  exercising hermetic fixture modules across supported capability collections.

### 6. Wesley-Postgres Preservation

`wesley-postgres` is the PostgreSQL-family extraction home. It should not be
abandoned while Wesley cleans house. Database semantics removed from Wesley
need explicit homes and follow-through there before more Postgres-shaped code
is deleted or reshaped in generic Wesley.

## Tensions

- **Backlog Residue**: Several older cards still read like Echo, jedit,
  Continuum, or database implementation work belongs in Wesley. The next
  cleanup slice must move, archive, or rewrite those cards.
- **Compatibility Churn**: IR, hash, directive, or generated-artifact changes
  can affect Echo and jedit fixtures. Those changes need explicit compatibility
  notes rather than accidental hash churn.
- **Legacy NPM Front Door**: README and guide now point core work at Cargo, but
  package scripts, docs drift checks, and old generator commands still assume
  legacy Node surfaces.
- **Two-Brain Confusion**: Rust and Node surfaces still coexist. The intended
  shape is one compiler brain (`crates/wesley-core`), one native command body
  (`crates/wesley-cli`), and legacy Node support surfaces under `packages/`
  until ported, extracted, or retired.
- **External Module Gap**: Wesley can name the domain-empty boundary, but
  external modules still need enough capability runtime and artifact evidence
  to consume it cleanly.

## Next Target

The immediate focus is **v0.0.5 clean house**:

1. Move external jedit, Echo, and Continuum backlog gravity out of Wesley.
2. Archive stale Continuum-era ideas that reference removed built-in product
   commands or generators.
3. Pull product-leftover deletion back into the active cleanup lane and finish
   the real verification work.
4. Freeze canonical IR fixtures and nondeterministic metadata policy.
5. Install JS/Rust parity evidence before deeper Rust-native cleanup.
6. Keep `wesley-postgres` visible as the database extraction home.

Echo and jedit do not need more Wesley feature gravity for their current work.
Wesley should coordinate on compatibility only when a concrete artifact, hash,
or generated-surface change requires it.
