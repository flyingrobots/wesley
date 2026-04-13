---
title: Continuum Versioned Contract Bundle Release
lane: v0.1.0
legend: TRANSMUTE
release: v0.1.0
---

# Continuum Versioned Contract Bundle Release

- Lane: `cool-ideas`
- Legend: `TRANSMUTE`

## Why now

Wesley can already compile real contract artifacts, but consumption still tends
to be repo-local or coordination-heavy. A future release shape could make one
versioned Continuum contract bundle publishable as a boring artifact family for
Echo, `warp-ttd`, and other consumers, without pretending Wesley owns their
runtime policy.

## Hill

Wesley can emit one versioned Continuum contract bundle release that packages
authored-contract identity, generated artifacts, and witness metadata into a
single consumer-friendly publication surface.

## Done looks like

- one release artifact packages schema hash, manifest / IR outputs, TypeScript
  surfaces, codec surfaces, and witness metadata together
- the bundle says clearly which parts are authoritative outputs and which parts
  are convenience surfaces
- downstream repos can consume the bundle without vendoring handwritten shadow
  contracts
- release naming and semver are driven by contract shape, not by arbitrary repo
  history
- the publication shape remains honest about foreign-authored homes when Wesley
  is compiling rather than authoring

## Repo Evidence

- `docs/architecture/continuum-wesley-role.md`
- `packages/wesley-core/src/ttd/codegen/orchestrator.mjs`
- `packages/wesley-generator-echo/src/EchoPlugin.mjs`
- `docs/specs/echo-ir-v2.md`
- `docs/invariants/schema-source-of-truth.md`

## Related Carry-Over

- `#453`
- `#456`
