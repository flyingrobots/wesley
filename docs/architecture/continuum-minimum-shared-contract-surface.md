# Continuum Minimum Shared Contract Surface
<!-- docs-truth: status=current owner=@flyingrobots -->

This note names the finite repo-local Continuum contract residue Wesley still
carries during the domain-empty extraction. It is intentionally narrower than
the broader Continuum target state in [docs/BEARING.md](../BEARING.md) and the
active design packet in
[docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md](../design/0003-continuum-contract-compiler/continuum-contract-compiler.md).

Generic Wesley no longer ships public `compile-ttd` or `bundle-echo` commands.
It also no longer exports `@wesley/core/ttd`. Those surfaces must reappear only
as Continuum-owned module commands or external packages if they are still
needed.

## Canonical Authored Home

Wesley's current minimum shared Continuum surface now spans:

- repo-local schema inputs that Wesley still authors directly under `schemas/`
- Continuum-authored shared families that Wesley compiles from external paths

The current concrete inputs are:

- `schemas/ttd-protocol.graphql`
- `schemas/echo-core-types.graphql`
- `<continuum-root>/schemas/continuum-receipt-family.graphql`

Wesley still carries a repo-local compatibility copy of the receipt family at
`schemas/continuum-receipt-family.graphql` while its current local fixtures and
witness tests catch up, but that copy is no longer the semantic authored home.

Those schema files are the current authored inputs. Generated
manifests, IR, TypeScript, Rust, codec vectors, and helper registries are
derived outputs, not peer authorities.

The original witness-backed minimum subset was the bounded TTD-plus-Echo pair.
Wesley now also ships a receipt-family witness scope through
`wesley witness-continuum --scope receipt-family`, backed by local family
fixtures under `test/fixtures/continuum/receipt-family/`. That witness proves
generated-leg coherence for the authored receipt family without pretending it
proves runtime, storage, or debugger semantics.

## Included Noun Families

### 1. TTD Protocol Control Family

Authored file:
- `schemas/ttd-protocol.graphql`

Current role:
- host-neutral debugger and control-plane schema still carried as repo-local
  residue; no generic public CLI compile command remains

Included nouns:
- scalars: `JSON`, `Hash`, `Timestamp`
- enums: `CursorRole`, `PlaybackMode`, `SeekResult`, `ComplianceStatus`,
  `ViolationSeverity`, `ObligationStatusKind`, `StepResultKind`
- channels: `TtdHeadChannel`, `TtdErrorsChannel`, `TtdComplianceChannel`,
  `TtdSessionChannel`
- event and codec contracts: `CursorMoved`, `SeekCompleted`, `SeekFailed`,
  `ViolationDetected`, `ComplianceUpdate`, `SessionStarted`, `SessionEnded`,
  `CursorCreated`, `CursorDestroyed`, `StepResult`, `Snapshot`,
  `ComplianceModel`, `Obligation`, `ObligationReport`
- state and judgment contracts: `Violation`, `TruthFrame`, `ObligationState`,
  `CursorState`
- operation roots: `Mutation`, `Query`
- invariant carrier: `TtdSystem`

Former Wesley-local derived surfaces, now external-module responsibility:
- manifest outputs such as `manifest/schema.json`,
  `manifest/contracts.json`, `manifest/manifest.json`, and
  `manifest/ttd-ir.json`
- TypeScript outputs such as `typescript/types.ts`, `typescript/zod.ts`,
  `typescript/registry.ts`, and `typescript/index.ts`

Repo evidence:
- relocated Continuum-owned implementation at `continuum/wesley/ttd/`
- `docs/design/wesley-extraction-map.md`

### 2. Echo CAS-Facing Payload Family

Authored file:
- `schemas/echo-core-types.graphql`

Current role:
- canonical CAS-facing payload and storage nouns still carried as repo-local
  residue; the generic Wesley Echo generator package has been retired

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
- `schemas/echo-core-types.graphql`
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

## Out Of Bounds

The following are not part of Wesley's current minimum shared contract surface:

- runtime semantics and storage behavior owned by Echo, `git-warp`, or
  `warp-ttd`
- Holmes, Moriarty, or BLADE judgment policy
- `Coordinate`, `EffectEmission`, and nearby causal-envelope noun families that
  are still target-state and are not yet authored in the schema files above
- generated manifest, IR, registry, TypeScript, Rust, and golden-vector files
  as authored sources

## Current Rule

- If a shared noun is in the current minimum surface, edit the authored schema
  in its real authored home:
  - `schemas/` for Wesley-owned local families
  - `<continuum-root>/schemas/` for Continuum-owned shared families
  and regenerate the derived surfaces.
- If a neighboring repo needs the same noun family, consume generated artifacts
  or an explicit publication boundary from the Continuum-owned module/package
  instead of re-authoring the contract by hand.
- Handwritten shadow contracts for the included nouns are out of bounds.
