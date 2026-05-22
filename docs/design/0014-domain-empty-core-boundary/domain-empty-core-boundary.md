---
title: Domain-Empty Core Boundary
legend: SOURCE
packet: 0014-domain-empty-core-boundary
status: active
release: v0.0.6
---

# Domain-Empty Core Boundary

## Sponsors

- Human: I can add compiler truth without accidentally turning Wesley back into
  a product, database, scheduler, or runtime policy repository.
- Agent: I can decide whether a proposed change belongs in generic Wesley,
  an external module, `wesley-postgres`, or a product repo before editing code.

## Hill

Wesley has one enforced core boundary: it owns generic GraphQL semantic
compilation, generic module contracts, and evidence plumbing. The `whatever`
side of `GraphQL -> whatever` is module-owned.

Product, runtime, database, scheduler, replication, transport, deployment, and
substrate truth semantics are not Wesley core features.

## Why This Cycle Exists

v0.0.5 cleaned up historical product gravity. v0.0.6 is now deepening Rust IR
truth and compatibility evidence. That work only stays coherent if the repo
also blocks new product and database semantics from entering the base platform.

The first Rust IR parity sentinel already gives Wesley a real compatibility
check. The next risk is not missing another product feature. The risk is
growing the compiler around old product assumptions while the Rust kernel and
module surfaces are still settling.

## Boundary Contract

### Wesley Owns

- GraphQL SDL parsing and semantic normalization.
- Domain-empty L1 IR bytes, hashes, fixture truth, and diagnostics.
- Generic schema diff, operation selection, directive argument extraction, and
  emitter primitives.
- Module discovery, module capability contracts, and module-owned target
  dispatch.
- Evidence plumbing for artifacts, realization shells, witness reports, and
  release checks.
- Hermetic fixtures that prove compiler behavior without making the fixture's
  product domain a Wesley responsibility.

### External Owners Own

- Echo law, handles, footprints, runtime admission, and observation semantics.
- jedit editing behavior and product workflows.
- Continuum product protocol families and release policy.
- WARPspace, `warp-ttd`, and `git-warp` runtime or substrate behavior.
- PostgreSQL and Supabase generation, execution, safety primitives, migrations,
  row-level security, and pgTAP behavior in `wesley-postgres`.
- Application deployment, scheduler, transport, replication, and storage
  semantics.

### Module Seam

External behavior enters Wesley through explicit module capability surfaces.
The generic compile command must discover targets from registered
`wesley.targets`; it must not carry built-in product or database target names.

That keeps the base platform auditable:

- no module loaded means no target-specific compile semantics are available
- a target name means a module registered it
- target collisions are module capability errors
- historical package residue does not define current Wesley ownership

## First Slice

This first slice is a boundary-definition and front-door enforcement slice.

It:

- pulls the domain-empty boundary card out of `docs/method/backlog/asap/`
- creates this packet as the active v0.0.6 boundary doctrine
- updates front-door docs to point at the packet
- reframes README extension examples as externally owned module families
- adds a repo-level Bats check for the packet link, backlog move, and
  module-owned compile target dispatch

It does not move behavior into `wesley-postgres`, Echo, jedit, Continuum, or
other sibling repos. Those moves need their own repo-local cycles.

## Playback Questions

1. Does the active design map define what Wesley core owns and what external
   owners own?
2. Does the front door link to the boundary packet instead of relying on
   scattered doctrine?
3. Does the ASAP queue stop carrying the pulled boundary card?
4. Does `compile` still discover targets from module capabilities rather than
   built-in product or database names?
5. Does PostgreSQL/Supabase behavior point at `wesley-postgres` as the owning
   home?
6. Does this slice avoid changing sibling repositories?

## Next Enforcement Slices

- Turn product/database front-door wording into a stronger docs or metadata
  audit if new residue appears.
- Add module capability fixture coverage for target dispatch, alias conflicts,
  and no-module diagnostics.
- Decide which historical Node package command surfaces are legacy support
  only, extraction debt, or still generic Wesley toolchain behavior.
- Keep `wesley-postgres` visible as the database extraction home while leaving
  its implementation work in that repository.

## Non-Goals

- Do not delete historical design packets that remain useful extraction
  context.
- Do not add product, database, runtime, or scheduler semantics while defining
  the boundary.
- Do not edit `~/git/wesley-postgres`, Echo, jedit, Continuum, `warp-ttd`, or
  `git-warp` from this Wesley branch.
- Do not retire legacy Node lowering in this packet.
