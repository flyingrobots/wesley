# Continuum Optic Admission Role Note

- Lane: `cool-ideas`
- Legend: `SOURCE`

## Why now

Continuum should not freeze a shared protocol family for optic admission yet.
Wesley, Echo, and one application still need to prove the compiled artifact,
registration, invocation, and witness path first.

Still, a lightweight role note could prevent repo drift while those proofs land:

- Wesley compiles artifacts and registration descriptors.
- Echo registers artifacts, returns handles, admits or obstructs invocations,
  instruments access, and emits witnesses.
- Authority layers issue capability grants and presentations.
- Applications hide artifact handles, basis references, and runtime coordinates
  behind product-facing adapters.

This is doctrine, not schema publication.

## Hill

Continuum has a draft role note for optic admission ownership without freezing
shared GraphQL or binary protocol contracts.

## Done looks like

- note names the ownership split across Wesley, Echo, authority layers, and apps
- note explicitly says no shared protocol family is frozen yet
- note links to the first Wesley optic artifact fixture
- note names the proof gates required before Continuum may publish a shared
  protocol family
- no schema files or generated artifacts are added

## Repo Evidence

- `docs/NORTHSTAR.md`
- `docs/architecture/continuum-wesley-role.md`
- `crates/wesley-core/tests/runtime_optic_artifact.rs`
