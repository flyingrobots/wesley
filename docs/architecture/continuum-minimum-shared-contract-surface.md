# Continuum Minimum Shared Contract Surface

<!-- docs-truth: status=current owner=@flyingrobots -->

This note names the finite Continuum-adjacent contract surface Wesley still
knows how to compile and witness during the domain-empty extraction. It is
intentionally narrower than the broader Continuum target state in
[docs/BEARING.md](../BEARING.md) and the active design packet in
[docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md](../design/0003-continuum-contract-compiler/continuum-contract-compiler.md).

Generic Wesley no longer ships public `compile-ttd` or `bundle-echo` commands.
It also no longer exports `@wesley/core/ttd`. Those surfaces must reappear only
as Continuum-owned module commands or external packages if they are still
needed.

## Canonical Authored Home

Wesley's current minimum shared Continuum surface now spans owner-provided
schema inputs:

- `warp-ttd` for the host-neutral debugger protocol
- Echo for Echo-local CAS/runtime/ABI families; the old Wesley-local Echo SDL
  was retired and must be reconciled against current Echo truth before reuse
- Continuum for shared receipt, settlement, neighborhood, and runtime-boundary
  families

The current concrete inputs are:

- `<warp-ttd-root>/schemas/warp-ttd-protocol.graphql`
- `<echo-root>/schemas/runtime/*.graphql` and Echo's runtime/ABI crates for
  current Echo-owned truth
- `<continuum-root>/schemas/continuum-receipt-family.graphql`
- `<continuum-root>/schemas/continuum-settlement-family.graphql`

Those owner-provided schema files are the current authored inputs. Generated
manifests, IR, TypeScript, Rust, codec vectors, and helper registries are
derived outputs, not peer authorities. Generic Wesley no longer carries
canonical product schema copies under its own `schemas/` directory.

The original witness-backed minimum subset was the bounded TTD-plus-Echo pair.
Wesley now also ships a receipt-family witness scope through
`wesley witness-continuum --scope receipt-family`, backed by local family
fixtures under `test/fixtures/continuum/receipt-family/`. That witness proves
generated-leg coherence for the authored receipt family without pretending it
proves runtime, storage, or debugger semantics.

## Included Noun Families

### 1. TTD Protocol Control Family

Authored file:

- `<warp-ttd-root>/schemas/warp-ttd-protocol.graphql`

Current role:

- host-neutral debugger and control-plane schema owned by `warp-ttd`; no
  generic public Wesley `compile-ttd` command remains

Included nouns:

- host identity and capability handshake
- lane catalog, playback head, and frame-view surfaces
- receipt summaries, effect emissions, delivery observations, and execution
  context summaries
- debugger command/query surfaces that remain host-neutral

Former Wesley-local derived surfaces, now external-module responsibility:

- manifest outputs such as `manifest/schema.json`,
  `manifest/contracts.json`, `manifest/manifest.json`, and
  `manifest/ttd-ir.json`
- TypeScript outputs such as `typescript/types.ts`, `typescript/zod.ts`,
  `typescript/registry.ts`, and `typescript/index.ts`

Repo evidence:

- `warp-ttd` owns `schemas/warp-ttd-protocol.graphql`
- relocated Continuum-owned implementation at `continuum/wesley/ttd/`
- `docs/design/wesley-extraction-map.md`

### 2. Echo CAS-Facing Payload Family

Authored home:

- Echo current runtime schema fragments under `<echo-root>/schemas/runtime/`
- Echo runtime / ABI crates for surfaces that are not currently SDL-authored

Current role:

- Echo-owned CAS-facing payload and storage nouns no longer live in generic
  Wesley. The old Wesley-local SDL was retired rather than promoted to active
  Echo schema truth because Echo already has newer runtime and ABI surfaces.

Included nouns:

- `FieldPatch`
- `WorldlineTickPatchV1`
- `SnapshotManifest`
- `ClaimRecord`
- `PrivateAtomRefV1`
- `OpaqueRefV1`

Former Wesley-local derived surfaces, now external-module responsibility:

- Echo IR output
- generated codec implementations and golden vectors used to pin layout and
  field ordering

Repo evidence:

- `echo` tracks `PLATFORM_reconcile-relocated-wesley-echo-schemas`
- `docs/design/wesley-extraction-map.md`

### 3. Continuum Receipt Family

Authored file:

- `<continuum-root>/schemas/continuum-receipt-family.graphql`

Current role:

- canonical authored home for the first frozen Continuum proving family:
  `Receipt`, `DeliveryObservation`, `Capability`, and `Witness`

Included nouns:

- enums: `DeliveryOutcome`, `ExecutionMode`, `CapabilityScope`,
  `WitnessKind`
- operational envelope: `Receipt`
- delivery-adjacent observation contract: `DeliveryObservation`
- declaration contract: `Capability`
- minimal semantic residue contract: `Witness`
- operation root: `Query`
- invariant carrier: `ContinuumReceiptFamilyInvariants`

Former Wesley-local derived surfaces, now external-module responsibility:

- manifest outputs such as `manifest/schema.json`,
  `manifest/contracts.json`, `manifest/manifest.json`, and
  `manifest/ttd-ir.json`
- TypeScript outputs such as `typescript/types.ts`, `typescript/zod.ts`,
  `typescript/registry.ts`, and `typescript/index.ts`
- Echo bundle outputs such as `ir.json`, codec files, and mocked `deliveries`
  inspect output

Repo evidence:

- `docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md`
- `docs/design/wesley-extraction-map.md`

### 4. Continuum Settlement Family

Authored file:

- `<continuum-root>/schemas/continuum-settlement-family.graphql`

Current role:

- canonical authored home for compare / plan / import / conflict settlement
  surfaces shared across Continuum consumers

Repo evidence:

- `continuum` owns `schemas/continuum-settlement-family.graphql`
- `docs/design/wesley-extraction-map.md`

## Out Of Bounds

The following are not part of Wesley's current minimum shared contract surface:

- runtime semantics and storage behavior owned by Echo, `git-warp`, or
  `warp-ttd`
- Holmes, Moriarty, or BLADE judgment policy
- `Coordinate`, `EffectEmission`, and nearby causal-envelope noun families that
  are still target-state and are not yet authored in the schema files above
- generated manifest, IR, registry, TypeScript, Rust, and golden-vector files
  as authored sources
- Echo-local CAS, runtime, and WASM ABI schema truth
- `warp-ttd` host-neutral debugger protocol ownership

## Current Rule

- If a shared noun is in the current minimum surface, edit the authored schema
  in its real authored home:
  - `warp-ttd/schemas/` for the host-neutral debugger protocol
  - `echo/schemas/` for Echo-local runtime, CAS, and ABI families
  - `<continuum-root>/schemas/` for Continuum-owned shared families
    and regenerate the derived surfaces.
- If a neighboring repo needs the same noun family, consume generated artifacts
  or an explicit publication boundary from the Continuum-owned module/package
  instead of re-authoring the contract by hand.
- Handwritten shadow contracts for the included nouns are out of bounds.
