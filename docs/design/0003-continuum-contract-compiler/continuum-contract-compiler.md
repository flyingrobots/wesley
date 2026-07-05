---
title: 'Continuum Contract Compiler'
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
  names the finite owner-provided contract surface Wesley currently compiles:
  `warp-ttd` owns the host-neutral debugger protocol, Echo owns Echo-local
  CAS/runtime schema truth, and Continuum owns the shared receipt and
  settlement families.
- [Wesley Role In Continuum](../../architecture/continuum-wesley-role.md)
  states Wesley's current job as contract compiler, publication-boundary
  manager, conformance anchor, and judgment bridge, with explicit non-ownership
  around runtime, storage, debugger, and substrate-fact policy.

## Extraction Status

The public `wesley compile-ttd` and `wesley bundle-echo` commands described in
this packet were later retired from generic Wesley during the domain-empty
v0.1.0 extraction. Recreate them only as Continuum-owned module commands or
external packages if the product surface is still needed.

## Scope Hard Condition

This cycle stays brutally narrow.

- The first proving family is frozen to `Receipt`,
  `DeliveryObservation`, and `Capability`, with a separate `Witness`
  surface.
- The cycle target authored home for that family is
  `<continuum-root>/schemas/continuum-receipt-family.graphql`.
- The original witness-backed minimum subset was the old Wesley-local
  `ttd-protocol` plus `echo-core-types` pair. That pair has been split to the
  owning repos: `warp-ttd` owns the debugger protocol and Echo owns the
  Echo-local CAS/runtime schema.
- The chosen family now has its own fixture-backed witness scope through
  `wesley witness-continuum --scope receipt-family`.
- No second family enters the first proof lane this cycle.

## Glossary

- `Observer`: projection or aperture over a lane or braid, not the full optic.
- `Footprint`: focus boundary for lawful rewrite and reintegration.
- `Witness`: minimal semantic residue needed for reversibility or lawful
  reassembly.
- `Receipt`: operational envelope around one realized rewrite; not the same
  thing as witness.
- `Reintegration`: the lawful step that stitches an updated focused region back
  into the next whole.

## Current State

- Wesley previously shipped a real TTD compile path through
  `wesley compile-ttd`; generic Wesley no longer ships that public command.
- Wesley previously shipped a real Echo schema-to-codec path through
  `@wesley/generator-echo`; generic Wesley no longer carries that package.
- Wesley previously shipped a first repo-visible Echo wrapper through
  `wesley bundle-echo`, which wrote bundle artifacts and a mocked
  `warp-ttd`-style `deliveries` inspect surface for local review; generic
  Wesley no longer ships that public command.
- Wesley now ships a first current-state witness command through
  `wesley witness-continuum`, which proves local coherence for the current TTD
  and Echo minimum surfaces without pretending the frozen receipt-family lane
  already exists.
- Continuum now carries the chosen receipt-family schema and ships
  family-specific fixtures, a real receipt-family witness scope, and a local
  anti-shadow publication-boundary check through its Wesley module.
- Wesley now emits realization shells that carry `sourceHash`, signed artifact
  inventory, and witness status for compiled legs. Those shells are part of the
  proving path, but they are not the witness proof by themselves.

## Proved This Cycle

This cycle only counts as proved when the chosen family has all of the
following:

- one authored schema home
- one canonical compile path
- one ownership table
- one anti-shadow enforcement rule
- one witness lane
- one boring CLI-centered inspection path

### Proof Scope

This cycle proves:

- schema-to-artifact consistency for the chosen family
- realization-shell integrity and source traceability for emitted artifacts
- fixture-level conformance for selected examples
- the semantic distinction between witness residue and receipt envelope

This cycle does not prove:

- runtime policy correctness
- storage semantics
- debugger semantics
- full Continuum completeness
- a full optic theory for WARP

## Deferred

- any second shared noun family
- full WARP optic laws
- proof that every operational receipt already carries sufficient witness data
- platform-wide runtime, storage, or observer policy
- a full observer-rights or property-certificate doctrine for cross-repo
  consumers

## Current Optic Discipline

This cycle now carries a stricter WARP-facing reading of the shared contract
surface:

- an observer is projection or aperture, not the full optic
- a footprint is the focus boundary for lawful rewrite and reintegration
- a witness is minimal semantic residue for reversibility or lawful
  reassembly, not the same thing as a receipt
- a receipt is the larger operational envelope around one realized rewrite
- admission of the shared contract family is separate from observation of one
  runtime envelope built from that family
- Wesley's compiler role is best read as compiling multiple interpretations of
  one declared rewrite or contract, not as merely emitting adjacent artifact
  families

## Realization and Witness Discipline

For the `receipt-family` lane, Wesley now treats the proof surfaces as:

- authored schema: the only contract authority
- lowered IR: Wesley's admitted internal reading of that schema
- emitted artifact family: the TTD and Echo legs produced from that IR
- realization shell: the manifest-plus-signatures layer that packages one leg
- witness output: the bounded proof result that certifies explicit properties of
  the emitted family and shell

That means the witness lane should certify properties such as source
traceability, artifact integrity, cross-leg coherence, and selected fixture
roundtrips without claiming runtime, debugger, or observer-policy truth that it
does not inspect.

The general doctrine for these surface boundaries now lives in
`docs/design/0004-realization-admission-and-witness/realization-admission-and-witness.md`.

## Ownership Snapshot

This table is the minimum ownership shape the cycle must make boringly
inspectable.

| Noun                  | Role                                                            | Owner                                                                                | Authored or generated                          | Source of truth                                             | Consumers                                  | Out of scope                          |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| `Receipt`             | operational envelope for one realized rewrite                   | Continuum semantics, Wesley compiler lane                                            | authored target                                | `<continuum-root>/schemas/continuum-receipt-family.graphql` | Echo, `warp-ttd`, Holmes-family outputs    | runtime policy, storage semantics     |
| `DeliveryObservation` | shared observation envelope adjacent to receipt                 | Continuum semantics, Wesley compiler lane                                            | authored target                                | `<continuum-root>/schemas/continuum-receipt-family.graphql` | Echo, `warp-ttd`, proof surfaces           | debugger policy, observer UX          |
| `Capability`          | shared declaration contract                                     | Continuum semantics, Wesley compiler lane                                            | authored target                                | `<continuum-root>/schemas/continuum-receipt-family.graphql` | Echo, `warp-ttd`, operator-facing judgment | execution semantics                   |
| `Witness`             | minimal semantic residue for lawful reversibility or reassembly | Wesley, for this cycle's proving family                                              | authored shape plus generated witness surfaces | chosen family schema plus witness lane outputs              | conformance checks, proof surfaces         | receipt-only operational metadata     |
| `Observer`            | projection or aperture over a lane or braid                     | neighboring observer policy, not Wesley's proving-family authority                   | foreign noun for this cycle                    | foreign observer-policy surfaces                            | `warp-ttd`, readers, debugger surfaces     | full rewrite optic, runtime semantics |
| `TickReceipt`         | larger operational shell around a realized step                 | neighboring runtime or debugger operational surfaces unless explicitly compiled here | operational envelope                           | foreign or future publication boundary                      | audit, debugging, scheduling surfaces      | minimal witness claim by default      |

## Canonical Compile Path

This is the cycle contract. Some steps are not shipped yet; the cycle is not
done until the whole path is real and inspectable.

| Step                | Surface                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Repo truth                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Authored source  | `<continuum-root>/schemas/continuum-receipt-family.graphql`                                                                                                                                                                                                                                                                                                                                                                                                                                    | chosen cycle target; now authored in Continuum                                    |
| 2. TTD compile      | `pnpm wesley compile --schema <continuum-root>/schemas/continuum-receipt-family.graphql --target warp-ttd --out-dir .wesley-cache/continuum/receipt-family`                                                                                                                                                                                                                                                                                                                                    | command shape exists today; compiler now accepts external authored paths          |
| 3. warp-ttd outputs | `.wesley-cache/continuum/receipt-family/warp-ttd/manifest/{schema.json,contracts.json,manifest.json,ttd-ir.json}` and `.wesley-cache/continuum/receipt-family/warp-ttd/typescript/{types.ts,zod.ts,registry.ts,index.ts}`                                                                                                                                                                                                                                                                      | output family exists today for current shared contract inputs                     |
| 4. Echo bundle      | `pnpm wesley compile --schema <continuum-root>/schemas/continuum-receipt-family.graphql --target echo --out-dir .wesley-cache/continuum/receipt-family` writing `.wesley-cache/continuum/receipt-family/echo/{ir.json,ops.generated.ts,schemas.generated.ts,client.generated.ts,raw_le_codec.generated.ts,raw_le_codec.generated.rs,wasm_abi_codec.generated.ts,wasm_abi_codec.generated.rs}` plus `.wesley-cache/continuum/receipt-family/echo/mock/deliveries.jsonl` and `mock/summary.json` | command and local inspect bundle exist today                                      |
| 5. Fixtures         | `test/fixtures/continuum/receipt-family/{minimal,boundary,roundtrip,invalid,receipt-vs-witness}.*`                                                                                                                                                                                                                                                                                                                                                                                             | fixture set now exists and is consumed by the receipt-family witness scope        |
| 6. Witness output   | `pnpm wesley witness-continuum --scope receipt-family` with the default `.wesley-cache/continuum/receipt-family/{ttd,echo,witness}` path family                                                                                                                                                                                                                                                                                                                                                | command exists today and proves one bounded local receipt-family conformance lane |

## No Shadow Contract Rule

`No handwritten shadow contracts` only counts as true when all of the
following are machine-checkable:

- the authored schema home for the chosen family is named exactly once
- generated artifact directories for the family are reserved and treated as
  derived outputs
- generated artifacts carry manifest traceability or provenance headers where
  the file format allows it
- a local check fails when the chosen family appears as a handwritten parallel
  contract outside the approved authored schema and generated output locations
- the manifest maps each generated artifact back to its schema source

## Witness Lane Contract

The witness lane is the runnable form of the [proof scope](#proof-scope)
above. It must make that scope machine-checkable without widening it.

For this cycle, that means the witness lane has to cash out the proof scope
through:

- selected fixtures for the chosen family
- selected round-trip operation vectors for the chosen family
- manifest and source traceability in emitted surfaces
- realization-shell integrity for the emitted legs
- one explicit receipt-versus-witness separation case

## Boring Operator Path

An agent or maintainer should be able to do the following without folklore:

1. find the canonical schema from the ownership table
2. run `wesley compile --target warp-ttd` for the schema
3. run `wesley compile --target echo` for the same schema
4. inspect a short emitted artifact summary instead of browsing a raw file tree
5. run `wesley witness-continuum`
6. read one pass/fail proof result

The cycle is incomplete if that path still depends on repo vibes.

The current witness command now proves two bounded scopes:
`current-minimum-shared-surface` for the original TTD-plus-Echo subset, and
`receipt-family` for the authored receipt family with local fixtures. Neither
scope should be read as proof of runtime, storage, debugger, or observer-rights
semantics.

## Supporting Slice Closeouts

- [Continuum Cross-Repo Drift Watch](./EVIDENCE_continuum-cross-repo-drift-watch.md)

## Playback Questions

### Human

- [ ] Can I point to one finite shared contract surface and tell which nouns
      Wesley owns as schemas or generated contracts?
- [ ] Can I identify one chosen artifact family, preferably receipt-adjacent
      causal-envelope nouns, and see a clear compile path from schema to Rust,
      TypeScript, codec contracts, manifests, registry ids, and fixtures
      without collapsing receipt into minimal witness?
- [ ] Can I see the chosen family named exactly as `Receipt`,
      `DeliveryObservation`, `Capability`, with a separate `Witness` surface,
      instead of inferring the proving family from vibes?
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
- [x] Can I detect when a proposed change introduces a handwritten shadow
      contract or blurs substrate facts into Wesley-native judgment?
- [x] Can I locate the anti-shadow rule and the failure modes without reading
      neighboring repos?

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

## Failure Modes

- generated TypeScript or manifest output diverges from the chosen schema
- Echo bundle output lacks manifest provenance or artifact traceability
- fixture vectors pass codec shape but fail witness expectations
- a handwritten duplicate contract appears outside the approved authored or
  generated locations
- receipt fields begin absorbing witness-only meaning or witness surfaces begin
  absorbing receipt-only operational metadata
- the proving path quietly expands beyond the frozen first family

## Appendix: Historical Backlog Pull Set

The related `v0.1.0/` backlog lane has been retired as historical extraction
context during the v0.0.5 clean-house release. Those repo-resident notes were
later removed from the current tree; use git history for that extraction
context.

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
