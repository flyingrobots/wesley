# Law IR v1

## Status

Design-lock substrate for `WLAW-001`.

This note defines the first closed Law IR target for `weslaw`. It is not an
implementation API yet. It is the contract the first implementation must lower
into before hashing, diffing, generation, or judgment.

## Decision

Law IR v1 is a closed, versioned semantic model.

`weslaw` authoring files, known formal Wesley directives, and future SDL+ syntax
are frontends. They are not canonical. Every frontend must lower into this Law
IR before Wesley treats the law as active compiler truth.

```text
authored law frontend
  -> draft Law AST
  -> typed Law IR v1
  -> bound Law IR v1
  -> canonical Law IR bytes
  -> lawHash
```

## Version Identity

The semantic model version is:

```text
wesley.law-ir/v1
```

The first canonical byte codec is:

```text
wesley.law-ir.canonical-json.v1
```

The first authoring frontend is:

```text
weslaw/v1
```

These identifiers are separate on purpose:

| Identifier                             | Owns                                           |
| -------------------------------------- | ---------------------------------------------- |
| `weslaw/v1`                            | Authored YAML shape and migration affordances. |
| `wesley.law-ir/v1`                     | Typed semantic model after frontend lowering.  |
| `wesley.law-ir.canonical-json.v1`      | Canonical bytes used for `lawHash`.            |
| `wesley.contract-bundle-manifest/v1`   | Emitted manifest tying shape, law, profile, and bundle hashes together. |
| `wesley.law-diff/v1`                   | Machine-readable semantic law diff report.     |

## Published Schema Artifacts

Law IR v1 must ship with machine-readable schemas. This is not optional.

The first schema artifacts are:

| Artifact                                                 | Purpose                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `schemas/wesley-law-ir-v1.schema.json`                   | JSON Schema for the typed Law IR v1 JSON representation.         |
| `schemas/weslaw-v1.schema.json`                          | JSON Schema for the parsed `weslaw/v1` authoring document shape. |
| `schemas/wesley-contract-bundle-manifest-v1.schema.json` | JSON Schema for the emitted contract bundle manifest.            |
| `schemas/wesley-law-diff-v1.schema.json`                 | JSON Schema for machine-readable semantic law diff reports.      |

The JSON Schema files validate structure. They are not the canonical hash input,
and they are not necessarily the permanent source-authoring format for the
schema contracts themselves. Wesley may author them directly in JSON at first,
then later generate them from Rust types, generate Rust types from them, or move
to another schema-authoring system if that proves cleaner.

`lawHash` still comes from bound, normalized Law IR bytes under
`wesley.law-ir.canonical-json.v1`.

If a future frontend or canonical codec is not JSON, Wesley must still publish a
machine-readable schema contract for that representation before treating it as a
supported interface.

## Bundle Shape

Law IR is compiled as part of a contract bundle:

```text
ContractBundleV1
  apiVersion: wesley.contract-bundle/v1
  shape: ShapeIrRef
  law: LawIrV1
  policyProfile: PolicyProfileRef?
  hashes: HashSetV1
```

`LawIrV1` contains only active semantic law. Draft suggestions produced by
`wesley init-law` stay outside the active Law IR until promoted.

## Law IR Root

```text
LawIrV1
  apiVersion: wesley.law-ir/v1
  family: string
  schemaHash: sha256
  registries: LawRegistrySetV1
  entries: [LawEntryV1]
```

Rules:

- `schemaHash` is required.
- `entries` are sorted by `id` before canonicalization.
- active entry ids are unique inside the contract bundle.
- draft entries are not present in canonical active Law IR.

## Common Entry Fields

Every active `LawEntryV1` has these fields:

```text
LawEntryV1
  id: LawId
  kind: LawKindV1
  subject: SubjectCoordinate
  tags: [string]
  provenance: ProvenanceRef?
  rationale: Rationale?
```

Hash posture:

| Field         | Included in `lawHash` | Notes                                       |
| ------------- | --------------------- | ------------------------------------------- |
| `id`          | yes                   | Stable identity of the law.                 |
| `kind`        | yes                   | Closed Law IR variant.                      |
| `subject`     | yes                   | Bound coordinate.                           |
| semantic body | yes                   | Variant-specific semantic fields.           |
| `tags`        | yes                   | Tags are semantic classification in v1.     |
| `provenance`  | no                    | Included in `lawDocumentHash` if requested. |
| `rationale`   | no                    | Human explanation, not semantic truth.      |

## Closed Law Kinds

Law IR v1 accepts exactly these kinds:

```text
scalarSemantics
variantLaw
footprintLaw
channelLaw
invariantLaw
```

Any other active kind is a fatal `WESLAW_UNKNOWN_KIND` diagnostic.

Conceptual Rust shape:

```rust
enum LawKindV1 {
    ScalarSemantics(ScalarSemanticsLawV1),
    VariantLaw(VariantLawV1),
    FootprintLaw(FootprintLawV1),
    ChannelLaw(ChannelLawV1),
    InvariantLaw(InvariantLawV1),
}
```

The implementation may choose a different internal representation, but it must
enforce the same closed variant set.

## Scalar Semantics Law

Subject kinds:

```text
scalar:<Name>
```

Semantic fields:

```text
ScalarSemanticsLawV1
  representation: integer | string | opaqueIdentifier
  minInclusive: integer?
  maxInclusive: integer?
  ordering: none | lamport | total | partial
  scope: string?
  forbids: [ScalarForbiddenInterpretation]
```

Forbidden interpretations v1:

```text
silentGraphQLIntNarrowing
```

Binding rules:

- subject must bind to a GraphQL scalar;
- integer ranges require `representation: integer`;
- `minInclusive` must not exceed `maxInclusive`;
- `ordering`, when present, must use the closed v1 ordering vocabulary;
- `silentGraphQLIntNarrowing` is meaningful only for integer-like scalars.

Deferred scalar extensions:

- `bytes` representation and byte-width constraints;
- forbidden interpretation enums for wall-clock time, runtime-global ordering,
  and human-display-label semantics;
- richer opaque-id metadata beyond the `opaqueIdentifier` representation.

## Variant Law

Subject kinds:

```text
input:<InputObjectName>
```

Semantic fields:

```text
VariantLawV1
  discriminator:
    field: InputFieldName
    enum: EnumName
  cases: [VariantCaseV1]

VariantCaseV1
  value: EnumValueName
  requires: [InputFieldName]
  forbids: [InputFieldName]
```

Binding rules:

- subject must bind to a GraphQL input object;
- discriminator field must exist on the input object;
- discriminator enum must bind to a GraphQL enum;
- every case value must bind to an enum value;
- `requires` and `forbids` fields must exist on the input object;
- a case may not both require and forbid the same field.

## Footprint Law

Subject kinds:

```text
operation:Query.<field>
operation:Mutation.<field>
operation:Subscription.<field>
```

Semantic fields:

```text
FootprintLawV1
  reads: [ResourceKind]
  writes: [ResourceKind]
  creates: [ResourceKind]
  forbids: [ResourceKind]
  slots: [FootprintSlotV1]
  closures: [FootprintClosureV1]
  createSlots: [FootprintCreateSlotV1]
  updates: [FootprintUpdateV1]
```

Slot fields:

```text
FootprintSlotV1
  name: SlotName
  kind: ResourceKind
  bindFromArg: ArgPath?
  bindFromSlot: SlotName?
  bindRelation: string?
  access: [read | write]
```

Closure fields:

```text
FootprintClosureV1
  name: SlotName
  fromSlot: SlotName
  operator: string
  argBindings: [ArgPath | SlotName]
  reads: [ResourceKind]
  cardinality: one | optional | many = one
```

Create-slot fields:

```text
FootprintCreateSlotV1
  name: SlotName
  kind: ResourceKind
  cardinality: one | optional | many = one
```

Update fields:

```text
FootprintUpdateV1
  slot: SlotName
  fields: [FieldName]
```

Binding rules:

- subject must bind to a root operation field;
- resource kinds bind through GraphQL type coordinates or explicit law
  registries;
- slot names are unique per footprint;
- `bindFromArg` paths must bind through the operation argument shape;
- `bindFromSlot` references must name an existing slot;
- create-slot names are unique per footprint;
- updates must target slots with write access;
- `forbids` must not overlap `reads`, `writes`, `creates`, slot kinds,
  closure reads, or create-slot kinds.

## Channel Law

Subject kinds:

```text
channel:<name>@<version>
```

Semantic fields:

```text
ChannelLawV1
  ordered: boolean
  version: u32
  compatibility:
    versioning: channel | semver | external
    semverCoupled: boolean
  messages: [ChannelMessageV1]

ChannelMessageV1
  field: FieldName
  type: TypeName
```

Binding rules:

- subject binds through known `@wes_channel` declarations or law registry
  channel declarations;
- subject version must equal semantic `version`;
- every message field must bind on the channel carrier type;
- every message type must bind to a GraphQL output type;
- changes to `ordered` or `version` are semantic changes even if shape is
  unchanged.

## Invariant Law

Subject kinds:

```text
type:<ObjectName>
input:<InputObjectName>
field:<TypeName>.<field>
operation:<Root>.<field>
family:<FamilyName>
```

Semantic fields:

```text
InvariantLawV1
  predicate: PredicateV1

PredicateV1 =
  fieldEquals { field: FieldPath, value: Literal }
  | fieldNonNegative { field: FieldPath }
  | external { verifier: VerifierId, ref: ExternalInvariantRef, inputContract: string? }
```

Rejected v1 shapes:

```yaml
expr: 'forall x in X: ...'
```

Raw string expressions are not executable v1 law. They may be preserved as
rationale or migrated to an external verifier reference.

Binding rules:

- subject must bind to a schema coordinate or declared family;
- typed predicate field paths must bind from the subject;
- external verifier ids must bind through the verifier registry;
- unknown predicate operations are fatal.

## Draft Law

Draft law exists only in authoring files. It is not active Law IR.

Allowed use:

- `wesley init-law` suggestions from comments;
- migration output for ambiguous directives;
- human review queues.

Rules:

- draft entries do not enter `lawHash`;
- draft entries do not affect generated artifacts;
- draft entries may fail binding without failing bundle compilation;
- draft entries are filtered before active kind/body validation;
- promotion from draft to active must be explicit.

## Law IR v1 Non-Goals

- no raw expression evaluator;
- no CEL or Rego frontend;
- no overlays without monotonic refinement checks;
- no SDL+ syntax;
- no runtime enforcement claims;
- no policy, evidence, or judgment collapse into semantic law.
