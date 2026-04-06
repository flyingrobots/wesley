---
title: "Continuum Contract Compiler"
---

## Sponsors

- Human: I can define one shared Continuum contract family in Wesley and trust
  that the generated artifacts, ownership boundaries, and proof surfaces stay
  coherent across Echo, `git-warp`, and `warp-ttd`.
- Agent: I can inspect Wesley and determine the canonical shared contract
  surface, the generated outputs, and the witness lane without guessing which
  repo or handwritten file secretly owns the shared nouns.

## Hill

Wesley proves one boring end-to-end Continuum contract family from schema to
generated artifacts to conformance witness, with explicit ownership boundaries
and no handwritten shadow contracts for the chosen shared nouns.

## Current Supporting Note

- [Continuum Minimum Shared Contract Surface](../../architecture/continuum-minimum-shared-contract-surface.md)
  names the finite repo-local authored surface Wesley currently carries:
  `schemas/ttd-protocol.graphql` and `schemas/echo-core-types.graphql` under
  `schemas/`.
- [Wesley Role In Continuum](../../architecture/continuum-wesley-role.md)
  states Wesley's current job as contract compiler, publication-boundary
  manager, conformance anchor, and judgment bridge, with explicit non-ownership
  around runtime, storage, debugger, and substrate-fact policy.

## Current Optic Discipline

This cycle now carries a stricter WARP-facing reading of the shared contract
surface:

- an observer is projection or aperture, not the full optic
- a footprint is the focus boundary for lawful rewrite and reintegration
- a witness is minimal semantic residue for reversibility or lawful
  reassembly, not the same thing as a receipt
- a receipt is the larger operational envelope around one realized rewrite
- Wesley's compiler role is best read as compiling multiple interpretations of
  one declared rewrite or contract, not as merely emitting adjacent artifact
  families

## Playback Questions

### Human

- [ ] Can I point to one finite shared contract surface and tell which nouns
      Wesley owns as schemas or generated contracts?
- [ ] Can I identify one chosen artifact family, preferably receipt-adjacent
      causal-envelope nouns, and see a clear compile path from schema to Rust,
      TypeScript, codec contracts, manifests, registry ids, and fixtures
      without collapsing receipt into minimal witness?
- [ ] Can I read the resulting witness surface and understand what is actually
      proven versus what is still target-state architecture?
- [ ] Are the ownership boundaries between Wesley, Echo, `git-warp`, and
      `warp-ttd` explicit enough that I do not have to infer them from repo
      habit?
- [ ] Can I tell when a noun is projection, policy, witness residue, or
      operational shell instead of treating those as interchangeable?

### Agent

- [ ] Can I discover the canonical schema location for the chosen Continuum
      family and tell which nearby files are generated, derived, or advisory?
- [ ] Can I map shared nouns to one owner without collapsing contract
      compilation into runtime policy, storage policy, or debugger policy?
- [ ] Can I inspect one local compile path and one witness path without relying
      on neighboring repos, ambient network state, or oral tradition?
- [ ] Can I inspect one declared rewrite or contract family and understand the
      compiled outputs as multiple interpretations of one shape rather than as
      unrelated generators?
- [ ] Can I detect when a proposed change introduces a handwritten shadow
      contract or blurs substrate facts into Wesley-native judgment?

## Accessibility and Assistive Reading

- The packet should read linearly as plain Markdown without requiring the Echo
  Continuum memo or a diagram to make basic sense.
- Shared noun families should be listed explicitly before rationale or
  examples.
- Current state and target state should stay visibly separated so assistive
  readers do not have to infer which claims are already true.

## Localization and Directionality

- Keep shared noun names short, literal, and stable across files.
- Prefer protocol and contract vocabulary such as `Receipt`,
  `DeliveryObservation`, and `Capability` over metaphor when the exact noun is
  known.
- Prefer explicit nouns such as `Observer`, `Lens`, `Witness`, and `Receipt`
  only when their role is stated clearly as projection, policy, semantic
  residue, or operational shell.
- Avoid directionality-dependent language such as "upstream" or "downstream"
  when ownership or generation can be stated directly.

## Agent Inspectability and Explainability

- Every claim about the Continuum role should point at repo-visible schema,
  generator, manifest, CLI, or witness surfaces.
- The packet should distinguish current Wesley capability from target-state
  platform architecture instead of presenting aspiration as shipped behavior.
- The packet should not collapse observer-relative projection into the full
  optic, or collapse receipt envelope into minimal witness.
- The queue should stay split between active Continuum work and deferred
  historical backlog rather than pretending all imported GitHub issues share the
  same priority.
- The first proving path should be boring on purpose: one artifact family, one
  compile surface, one witness lane.
- The first proving path should also be precise on noun boundaries: projection,
  footprint, rewrite, witness, receipt, and reintegration should not blur into
  one another.

## Related Backlog Pull Set

- [Continuum Ownership Map For Shared Nouns](../../method/backlog/asap/SOURCE_continuum-ownership-map-for-shared-nouns.md)
- [Continuum Local Compile And Inspect Surface](../../method/backlog/asap/RUNTIME_continuum-local-compile-and-inspect-surface.md)
- [Continuum Conformance And Round-Trip Witness](../../method/backlog/asap/EVIDENCE_continuum-conformance-and-roundtrip-witness.md)
- [Continuum Protocol Surface Cutover](../../method/backlog/up-next/SOURCE_WESLEY_protocol-surface-cutover.md)
- [Continuum Receipt Family Artifact Path](../../method/backlog/up-next/TRANSMUTE_continuum-receipt-family-artifact-path.md)

## Non-goals

- [ ] Claiming that every Continuum shared noun is already frozen or fully
      implemented in Wesley today.
- [ ] Rewriting Echo, `git-warp`, or `warp-ttd` from this repo.
- [ ] Building runtime policy, storage policy, or debugger policy inside
      Wesley's contract-compiler layer.
- [ ] Treating observer projection as if it were already the full optic or
      treating any receipt envelope as if it were already the minimal witness.
- [ ] Treating one generated witness lane as proof that the full platform is
      finished.
- [ ] Re-prioritizing the entire imported historical GitHub queue in the same
      cycle.
