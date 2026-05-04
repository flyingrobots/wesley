# BEARING
<!-- docs-truth: status=experimental owner=@flyingrobots -->

Current direction and active tensions. Historical ship data is in `CHANGELOG.md`.

```mermaid
timeline
    Phase 1 : Domain-Empty Core : GraphQL Lowering : Generic Artifact Bundles
    Phase 2 : External Modules : Target Registry : Module-Owned Generators
    Phase 3 : Generic Assurance : Witness Registries : Evidence Bundles
    Phase 4 : Repo Extraction : Domain Packages Out : Clean Core Release
```

## Active Gravity

### 1. Domain-Empty Core
- Wesley's identity is the core `GraphQL -> whatever` compiler and assurance
  toolchain.
- The `whatever` must come from explicitly loaded external modules, not
  built-in product or database semantics.
- Continuum-specific behavior belongs in Continuum or a Continuum-owned module
  repo.
- PostgreSQL/Supabase behavior belongs in `wesley-postgres`, not in
  `wesley-core`, Wesley generators, or generic host packages.

### 2. Module Capability Runtime
- Using the basic module capability registry as the default seam between
  loaded modules and Wesley base verbs.
- Keeping `wesley compile` dispatching only through module-owned
  `wesley.targets`.
- Keeping Wesley core CI independent of external product and database repos by
  exercising a hermetic fixture module across every supported capability
  collection.

### 3. Extraction Rigor
- Treating the current Continuum, WARPspace, PostgreSQL, Supabase, Echo, TTD,
  and product-backend references as wrong-repo residue unless they are explicit
  historical docs, extraction notes, or already-relocated module surfaces.
- Moving product/domain generators, witnesses, policies, and workspace tools to
  their owning repos.
- Updating docs as behavior moves so no stale surface looks authoritative.

## Tensions

- **Wrong-Repo Residue**: Wesley still contains historical product and database
  code that belongs in external modules.
- **Capability Gap**: The module registry and compile target dispatch exist,
  but Holmes, Watson, Moriarty, and BLADE still need real runtime dispatch over
  module-owned capability collections.
- **Documentation Drag**: Older docs still describe Continuum and PostgreSQL as
  Wesley lanes instead of extraction targets.
- **Verification Split**: Generic witness/evidence machinery needs to stay
  independent from module-owned proof scopes and domain policy.

## Next Target

The immediate focus is **Domain-Empty Wesley**: build the module capability
registry, make target dispatch module-owned, and remove or relocate every
Continuum/PostgreSQL-shaped surface from the Wesley repo.
