# BEARING
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This signpost summarizes direction. It does not create commitments or replace
backlog items, design packets, retros, or CLI status.

## Where are we going?

Current priority: make Wesley earn its Continuum role as the contract compiler,
publication-boundary manager, conformance anchor, and judgment bridge for the
shared hot/cold causal surface.

For now, that means Wesley should align around five near-term moves:

- keep the current WARP-facing minimum shared surface explicit: the TTD
  protocol control family and the Echo CAS-facing payload family, not a vague
  pile of future Continuum nouns
- make the TTD path boring and inspectable: authored schema to Wesley compile
  to manifest, IR, TypeScript, registry, and foreign-language consumer
  surfaces for host-neutral tools such as `warp-ttd`
- make the Echo path boring and inspectable: authored schema to Echo IR to
  codec / decodec artifacts, layout proof, and golden vectors that Echo-side
  consumers can trust
- keep `git-warp` on the substrate fact side of the split while Wesley owns
  contract coherence, publication boundaries, conformance proof, and
  operator-facing judgment
- publish an ownership map that keeps WARP, Echo, `git-warp`, `warp-ttd`, and
  Wesley from drifting into handwritten shadow contracts or accidental peer
  authorities

## What just shipped?

The repo already has a real starting point for this direction:

- the current repo-local minimum shared Continuum surface is now named
  explicitly in
  `docs/architecture/continuum-minimum-shared-contract-surface.md`; today that
  means the authored schema pair `schemas/ttd-protocol.graphql` and
  `schemas/echo-core-types.graphql`
- Wesley's operating role in Continuum is now written down in
  `docs/architecture/continuum-wesley-role.md`, separating contract
  compilation, publication boundaries, conformance, and judgment from runtime,
  storage, debugger, and substrate-fact ownership
- Wesley already ships a real TTD / protocol-compiler lane in
  `schemas/ttd-protocol.graphql`,
  `packages/wesley-cli/src/commands/compile-ttd.mjs`, and
  `packages/wesley-core/src/ttd/`; that lane emits manifest surfaces such as
  `manifest/schema.json`, `manifest/contracts.json`, `manifest/manifest.json`,
  `manifest/ttd-ir.json`, plus TypeScript surfaces such as
  `typescript/types.ts`, `typescript/zod.ts`, and `typescript/registry.ts`
- Wesley already ships a real Echo schema-to-codec lane in
  `schemas/echo-core-types.graphql` and `@wesley/generator-echo`; that lane
  emits Echo IR plus codec / decodec surfaces and golden vectors rather than
  leaving Echo-facing contract shape as repo folklore
- Holmes counterfactual work already keeps `git-warp` on the substrate side of
  the boundary instead of reimplementing comparison, braid, or transfer
  semantics inside Wesley product judgment
- the surrounding publication-boundary story is getting more honest: Wesley
  can carry local authored schemas, and it can also compile from explicit
  foreign authored homes without pretending every shared WARP contract lives in
  this repo
- the GitHub issue queue now lives in the filesystem, so this direction can be
  carried as METHOD backlog instead of tracker folklore

## What feels wrong?

- the minimum shared surface is now named, but it is still split across two
  adjacent schema families instead of one boring receipt-family proving path
- the repo has TTD manifests and Echo codec / decodec pieces, but not yet one
  boring end-to-end WARP contract path that proves the whole chain from shared
  noun family to every intended consumer surface
- Ownership of shared nouns is still too easy to infer incorrectly from repo
  habit instead of from explicit doctrine, especially once foreign authored
  homes and local mirrors both exist
- the clean split between Echo runtime semantics, `git-warp` substrate facts,
  `warp-ttd` observer policy, and Wesley contract / judgment doctrine is now
  legible in notes, but not yet enforced by one small reusable ownership map
- Too much historical surface area still reads like generic database-change
  product work when the current bearing is narrower: keep the Continuum
  contract surface honest across WARP, TTD, Echo, and `git-warp`.
