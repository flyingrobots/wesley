# BEARING
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This signpost summarizes direction. It does not create commitments or replace
backlog items, design packets, retros, or CLI status.

## Where are we going?

Current priority: make Wesley earn its Continuum role as the contract compiler,
publication-boundary manager, conformance anchor, and judgment bridge for the
shared hot/cold causal surface.

For now, that means Wesley should align around four near-term moves:

- freeze a minimum shared contract surface for Continuum nouns such as protocol
  envelopes, causal coordinates, receipts, effect emissions, delivery
  observations, capability declarations, and manifest / registry identifiers
- prove one boring end-to-end artifact family, preferably receipts, from Wesley
  schema to generated Rust, TypeScript, codec contracts, manifests, and
  fixtures
- add conformance proof so generated surfaces round-trip canonically instead of
  relying on repo folklore
- publish an ownership map that keeps `git-warp`, Echo, `warp-ttd`, and Wesley
  from drifting into handwritten shadow contracts

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
- Wesley already ships TTD / protocol-compiler surfaces in
  `schemas/ttd-protocol.graphql`, `packages/wesley-core/src/ttd/`, and
  `packages/wesley-cli/src/commands/compile-ttd.mjs`
- Holmes counterfactual work already keeps `git-warp` on the substrate side of
  the boundary instead of reimplementing it inside Wesley product semantics
- the GitHub issue queue now lives in the filesystem, so this direction can be
  carried as METHOD backlog instead of tracker folklore

## What feels wrong?

- the minimum shared surface is now named, but it is still split across two
  adjacent schema families instead of one boring receipt-family proving path
- The repo has protocol-compiler pieces, but not yet one boring receipt-family
  artifact path that proves the whole chain.
- Ownership of shared nouns is still too easy to infer incorrectly from repo
  habit instead of from explicit doctrine.
- Too much historical surface area still reads like generic database-change
  product work when the current bearing is narrower: keep the Continuum
  contract surface honest.
