# Continuum Minimum Shared Contract Surface
<!-- docs-truth: status=current owner=@flyingrobots -->

This note names the finite repo-local Continuum contract surface Wesley
currently carries. It is intentionally narrower than the broader Continuum
target state in [docs/BEARING.md](../BEARING.md) and the active design packet
in
[docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md](../design/0003-continuum-contract-compiler/continuum-contract-compiler.md).

## Canonical Authored Home

The current authored home for Wesley's minimum shared Continuum surface is the
`schemas/` directory, specifically:

- `schemas/ttd-protocol.graphql`
- `schemas/echo-core-types.graphql`
- `schemas/continuum-receipt-family.graphql`

Those files are the current repo-local authored inputs. Generated
manifests, IR, TypeScript, Rust, codec vectors, and helper registries are
derived outputs, not peer authorities.

The current witness-backed minimum subset is still the bounded TTD-plus-Echo
pair. `schemas/continuum-receipt-family.graphql` is now authored locally as the
frozen proving-family target, but the family-specific fixture and witness lane
are not yet wired. Pretending the authored schema already implies a finished
proof lane would blur current state with target-state architecture.

## Included Noun Families

### 1. TTD Protocol Control Family

Authored file:
- `schemas/ttd-protocol.graphql`

Current role:
- host-neutral debugger and control-plane schema compiled by
  `wesley compile-ttd`

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

Current derived surfaces:
- `wesley compile-ttd` manifest outputs such as `manifest/schema.json`,
  `manifest/contracts.json`, `manifest/manifest.json`, and
  `manifest/ttd-ir.json`
- `wesley compile-ttd` TypeScript outputs such as `typescript/types.ts`,
  `typescript/zod.ts`, `typescript/registry.ts`, and `typescript/index.ts`

Repo evidence:
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-core/src/ttd/`
- `packages/wesley-cli/test/compile-ttd.bats`

### 2. Echo CAS-Facing Payload Family

Authored file:
- `schemas/echo-core-types.graphql`

Current role:
- canonical CAS-facing payload and storage nouns currently exercised through
  `@wesley/generator-echo` IR and codec paths

Included nouns:
- `FieldPatch`
- `WorldlineTickPatchV1`
- `SnapshotManifest`
- `ClaimRecord`
- `PrivateAtomRefV1`
- `OpaqueRefV1`

Current derived surfaces:
- `@wesley/generator-echo` IR output
- generated codec implementations and golden vectors used to pin layout and
  field ordering

Repo evidence:
- `packages/wesley-generator-echo/test/core-types.test.mjs`
- `packages/wesley-generator-echo/test/privacy-types-encoding.test.mjs`
- `packages/wesley-generator-echo/test/golden-vectors/privacy-types.json`

### 3. Continuum Receipt Family

Authored file:
- `schemas/continuum-receipt-family.graphql`

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

Current derived surfaces:
- `wesley compile-ttd` manifest outputs such as `manifest/schema.json`,
  `manifest/contracts.json`, `manifest/manifest.json`, and
  `manifest/ttd-ir.json`
- `wesley compile-ttd` TypeScript outputs such as `typescript/types.ts`,
  `typescript/zod.ts`, `typescript/registry.ts`, and `typescript/index.ts`
- `wesley bundle-echo` outputs such as `ir.json`, codec files, and mocked
  `deliveries` inspect output

Repo evidence:
- `packages/wesley-cli/test/compile-ttd.bats`
- `packages/wesley-cli/test/bundle-echo.bats`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md`

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
  in `schemas/` and regenerate the derived surfaces.
- If a neighboring repo needs the same noun family, consume generated artifacts
  or an explicit publication boundary instead of re-authoring the contract by
  hand.
- Handwritten shadow contracts for the included nouns are out of bounds.
