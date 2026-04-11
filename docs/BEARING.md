# BEARING
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This signpost summarizes direction. It does not create commitments or replace
backlog items, design packets, retros, witnesses, or CLI status.

## Current Direction

Current priority: make Wesley's Continuum role boring and inspectable without
lying about what is already real.

That currently means:

- freeze one shared contract family with one authored home, one ownership map,
  one compile path, and one witness lane
- keep the publication boundary explicit between Wesley, Echo, `git-warp`, and
  `warp-ttd`
- strengthen anti-shadow rules so generated or mirrored contracts do not become
  accidental peer authorities
- keep Wesley on the contract, conformance, and judgment side of the split
  instead of absorbing runtime, storage, or debugger policy

## What Is Already Real In The Repo

- Wesley has a real TTD compile path through
  `schemas/ttd-protocol.graphql`, `wesley compile-ttd`, and
  `packages/wesley-core/src/ttd/`.
- Wesley now has a real compiler-shaped Continuum entry point through
  `wesley compile`, including a lightweight realization manifest under the chosen
  output root.
- Wesley has a real Echo bundle wrapper through
  `schemas/echo-core-types.graphql`, `@wesley/generator-echo`, and
  `wesley bundle-echo`.
- Wesley now has a real current-state conformance witness through
  `wesley witness`, with `wesley witness-continuum` kept as a compatibility
  alias, plus explicit `receipt-family` and `settlement-family` scopes.
- The current minimum shared Continuum surface is explicitly named in
  [Continuum Minimum Shared Contract Surface](./architecture/continuum-minimum-shared-contract-surface.md).
- Wesley's role in Continuum is explicitly bounded in
  [Wesley Role In Continuum](./architecture/continuum-wesley-role.md).
- The most recent Continuum proving packet is
  [Continuum Contract Compiler](./design/0003-continuum-contract-compiler/continuum-contract-compiler.md),
  and it closed as a `partial` landing in
  [its retro packet](./method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md).
- Wesley's METHOD closeout and release surfaces are now explicit in
  `docs/method/retro/`, `docs/method/graveyard/`, `docs/method/releases/`, and
  `docs/releases/`.

## What Still Feels Wrong

- The first frozen receipt-family proving lane now has a real local witness,
  but that proof is still bounded to generated-leg coherence rather than
  runtime, storage, or debugger semantics.
- The current witness shape is better than before, but it is still carrying
  two bounded scopes instead of one fully generalized realization manifest and
  anti-shadow enforcement path.
- Ownership of shared nouns is clearer than before, but still not enforced by
  one small reusable ownership map and one anti-shadow check.
- The repo now has a closeout shape, but not yet a deep habit of closed-cycle
  packets and witness directories.
- Wesley's public identity is still split between the older PostgreSQL-first
  story and the newer Continuum contract-compiler hill. That split is real and
  should stay honest until one surface clearly dominates.

## Near-Term Pulls

- [SOURCE_continuum-ownership-map-for-shared-nouns](./method/backlog/asap/SOURCE_continuum-ownership-map-for-shared-nouns.md)
- [RUNTIME_continuum-local-compile-and-inspect-surface](./method/backlog/asap/RUNTIME_continuum-local-compile-and-inspect-surface.md)
- [EVIDENCE_continuum-conformance-and-roundtrip-witness](./method/backlog/asap/EVIDENCE_continuum-conformance-and-roundtrip-witness.md)

Those are the next honest moves if Wesley is going to earn the Continuum role
it is now claiming in the docs.
