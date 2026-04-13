---
title: Continuum Contract Release And Sync Commands
lane: v0.1.0
legend: TRANSMUTE
release: v0.1.0
---

# Continuum Contract Release And Sync Commands

## Why now

Design packet `0005-continuum-contract-bundle-release-and-sync` now makes one
important cut explicit: the thing that should cross repo boundaries is a
versioned contract bundle, not a pile of ad hoc generated directories and not a
direct dependency on Wesley compiler internals.

The repo still lacks the boring operator surface that would make that model
real.

## Hill

Wesley ships one generic `contract release` / `contract sync` flow that can run
with the Continuum profile, emit one versioned contract bundle with semver and
exact schema identity, and update declared consumer mirrors without handwritten
copy rules.

## Done looks like

- `wesley contract release` emits a root bundle manifest binding release
  semver, `sourceHash`, realization shell, witness output, and target artifact
  projections together
- `wesley contract sync` can apply a released bundle to a declared consumer
  repo surface and fail if the resulting mirror still drifts
- `@wesley/continuum` declares the Continuum family defaults, consumer kinds,
  and mirror conventions for the commands
- the commands stay generic; the Continuum-specific behavior is profiled rather
  than hardcoded into the command core
- docs explain that consumer repos should read released bundle projections
  instead of importing Wesley compiler internals directly

## Repo Evidence

- `docs/design/0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md`
- `docs/architecture/continuum-wesley-role.md`
- `packages/wesley-continuum/src/`
- `packages/wesley-cli/src/commands/witness.mjs`
- `packages/wesley-cli/src/commands/drift-watch.mjs`

## Related Carry-Over

- `SOURCE_continuum-ownership-map-for-shared-nouns.md`
- `EVIDENCE_continuum-conformance-and-roundtrip-witness.md`
