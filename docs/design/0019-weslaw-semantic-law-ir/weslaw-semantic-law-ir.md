---
title: weslaw Semantic Law IR
legend: OWN
packet: 0019-weslaw-semantic-law-ir
status: active
release: v0.0.8
---

# weslaw Semantic Law IR

## Status

Active design packet.

Decision posture:

```text
ACCEPT:  weslaw as Wesley's semantic law layer.
ENHANCE: the v1 specification before implementation.
DEFER:   Wesley SDL+ until Law IR is stable, boring, and useful.
```

## Question

How should Wesley represent semantic contract law that GraphQL SDL cannot carry
cleanly, without turning Wesley into a product runtime, a policy engine, or a
second drifting source of truth?

## Hill

Wesley compiles contract bundles.

GraphQL SDL remains sovereign over structural shape. `weslaw` becomes sovereign
over semantic law. The combined, bound, canonical contract bundle is the unit
Wesley hashes, diffs, emits, explains, validates, and hands to assurance tools.

The core product is not YAML. The core product is a typed, versioned,
canonical Law IR.

```text
GraphQL SDL + weslaw + policy/profile input
    -> Shape IR + Law IR + Policy/Profile IR
    -> canonical bundle
    -> hashes, diffs, artifacts, validators, manifests, evidence, judgment
```

## Why This Exists

Wesley has intentionally narrowed itself into a Rust-native compiler kernel and
assurance toolchain. That is good. The next pressure is not more runtime
ownership. The pressure is more precise contract meaning.

GraphQL SDL gives Wesley a strong authored shape language:

- type names
- field names
- arguments
- nullability
- enums
- unions
- input objects
- operation signatures
- attached directives

But the surrounding Wesley ecosystem already needs laws that ordinary GraphQL
cannot express cleanly:

- opaque scalar identity and width rules
- logical counters that are not wall-clock timestamps
- discriminated input envelopes standing in for input unions
- operation read/write/create/forbid footprints
- channel ordering and protocol version posture
- cross-object invariants
- evidence and witness posture
- app-specific semantic refinements

Today those laws leak into three places:

1. prose comments;
2. directive mini-languages;
3. downstream interpreter code.

That is not compiler-grade truth. It is scattered meaning. `weslaw` exists to
make that meaning explicit, typed, bound, canonical, hashable, diffable, and
available to generated artifacts and assurance systems.

The diagnosis is simple:

```text
GraphQL has been accidentally hosting two languages:
  1. a shape language;
  2. a hidden semantic-law language.
```

`weslaw` names the second language and moves it into a compiler-controlled
home.

## Non-Negotiables

- Law IR is the product. YAML, directives, and future SDL+ are frontends.
- GraphQL owns structural shape. `weslaw` must not introduce GraphQL types,
  fields, arguments, enum values, input fields, unions, interfaces, or operation
  signatures.
- Active law must bind strictly. Dangling schema coordinates, wrong subject
  kinds, duplicate law ids, conflicting laws, invalid overlays, and unknown
  non-shape symbols are fatal errors.
- Law documents must anchor to a canonical schema hash. Normal compilation
  fails when the active schema hash does not match the law anchor.
- Law IR and the `weslaw/v1` authoring shape must publish machine-readable
  schemas. If the representation is JSON, that means JSON Schema under
  `schemas/`; if a later representation is not JSON, it still needs a published
  schema contract.
- Hashes are computed from normalized Law IR, not YAML bytes.
- Semantic law hashes exclude comments, formatting, source spans, and rationale
  prose.
- Prose rationale may be preserved in a separate document/provenance hash.
- `expr: "..."` string invariants are not v1 executable law.
- v1 invariants use typed predicate forms or external verifier references.
- Policy, evidence, and judgment are separate from semantic law.
- Overlays may refine only when the compiler can prove monotonic refinement.
- Known formal Wesley directives may lower into Law IR.
- Comments and unknown/stringly directives may scaffold provisional law only.
- Wesley SDL+ is deferred until the Law IR, binder, canonicalization, and diffs
  are stable.

## Design Lock Artifacts

This packet's first implementation PR locks the v1 substrate through companion
specs and fixtures:

- [Law IR v1](./LAW_IR_V1.md) defines the closed semantic model, law kinds,
  active/draft behavior, and v1 non-goals.
- [Coordinates And Registries](./COORDINATES_AND_REGISTRIES.md) defines subject
  coordinates, non-shape resource/verifier/channel registries, schema-hash
  anchors, and explicit discovery.
- [Canonicalization And Diagnostics](./CANONICALIZATION_AND_DIAGNOSTICS.md)
  defines canonical byte rules, hash inputs, active versus draft semantics, and
  the v1 diagnostic catalog.
- [weslaw fixtures](../../../test/fixtures/weslaw/README.md) define accepted
  and rejected substrate examples for scalar, variant, footprint, channel, and
  invariant law.

## Vocabulary

| Term               | Meaning                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Shape              | The GraphQL-owned structural contract: types, fields, arguments, enum values, operation signatures, nullability, and lists.           |
| Law                | Semantic facts that constrain or explain meaning: scalar semantics, variants, footprints, channels, invariants, and evidence posture. |
| Contract bundle    | The bound unit containing Shape IR, Law IR, policy/profile IR, hashes, manifests, and provenance.                                     |
| Shape IR           | Wesley's canonical lowered representation of authored GraphQL SDL shape.                                                              |
| Law IR             | Wesley's canonical lowered representation of semantic law.                                                                            |
| Policy/Profile IR  | Enforcement posture for a context, such as local, CI, release, or certification.                                                      |
| Evidence           | What Wesley generated, observed, witnessed, or verified.                                                                              |
| Judgment           | A downstream conclusion over shape, law, policy, and evidence.                                                                        |
| Subject coordinate | A stable reference to a schema or law subject, such as `scalar:WorldlineTick` or `operation:Mutation.replaceRangeAsTick`.             |
| Law id             | A globally stable identifier for one semantic law entry.                                                                              |
| Law frontend       | An authored input form that lowers into Law IR: v1 YAML, known directives, or future SDL+.                                            |
| Overlay            | A law document that refines base law without weakening it.                                                                            |
| Rebind             | An explicit migration workflow that checks whether existing law still binds to a changed schema hash.                                 |

## Architecture

### Contract Bundle Pipeline

```mermaid
flowchart TD
    Sdl[GraphQL SDL]
    Directives[Known Wesley Directives]
    Weslaw[weslaw YAML v1]
    Policy[Policy/Profile Config]

    ShapeParser[SDL Parser]
    ShapeLowerer[Shape Lowerer]
    LawLoader[Law Loader]
    DirectiveLowerer[Directive To Law Lowerer]
    Binder[Strict Binder]
    Canon[Canonicalizer]
    Diff[Semantic Diff Engine]
    Emitters[Emitters And Validators]
    Manifest[Bundle Manifest]
    Assurance[Holmes / Watson / Moriarty / BLADE]

    ShapeIr[(Shape IR)]
    LawIr[(Law IR)]
    PolicyIr[(Policy/Profile IR)]
    Bundle[(Contract Bundle)]

    Sdl --> ShapeParser --> ShapeLowerer --> ShapeIr
    Directives --> DirectiveLowerer --> LawIr
    Weslaw --> LawLoader --> LawIr
    Policy --> PolicyIr

    ShapeIr --> Binder
    LawIr --> Binder
    PolicyIr --> Binder

    Binder --> Canon --> Bundle
    Bundle --> Diff
    Bundle --> Emitters
    Bundle --> Manifest
    Bundle --> Assurance

    classDef input fill:#f7f7f7,stroke:#555,color:#111;
    classDef ir fill:#e9f5ff,stroke:#336699,color:#111;
    classDef process fill:#fff7e6,stroke:#996600,color:#111;
    classDef output fill:#f0fff0,stroke:#337733,color:#111;
    class Sdl,Directives,Weslaw,Policy input;
    class ShapeIr,LawIr,PolicyIr,Bundle ir;
    class ShapeParser,ShapeLowerer,LawLoader,DirectiveLowerer,Binder,Canon,Diff process;
    class Emitters,Manifest,Assurance output;
```

The pipeline has one critical property: every authored law frontend converges
into the same Law IR before hashing, diffing, or generation.

### Layer Ownership

```mermaid
flowchart TB
    subgraph AuthoredInputs[Authored Inputs]
        Graphql[GraphQL SDL]
        LawYaml[weslaw YAML]
        KnownDirectives[Known Formal Directives]
        Profiles[Policy/Profile Config]
    end

    subgraph WesleyCompiler[Wesley Compiler]
        ShapeIr[Shape IR]
        LawIr[Law IR]
        ProfileIr[Policy/Profile IR]
        Bundle[Bound Contract Bundle]
    end

    subgraph Outputs[Outputs]
        Hashes[Schema / Law / Profile / Bundle Hashes]
        Diffs[Human And Machine Diffs]
        Artifacts[Generated Artifacts]
        Validators[Generated Validators]
        Manifest[Generation Manifest]
        Evidence[Evidence Inputs]
    end

    subgraph ExternalOwners[External Owners]
        Echo[Echo Runtime Law]
        Continuum[Continuum Family Semantics]
        Jedit[jedit App Contract]
        WarpTtd[warp-ttd Protocol Law]
        WesleyPostgres[wesley-postgres Database Semantics]
        Holmes[Holmes Judgment]
    end

    Graphql --> ShapeIr
    LawYaml --> LawIr
    KnownDirectives --> LawIr
    Profiles --> ProfileIr
    ShapeIr --> Bundle
    LawIr --> Bundle
    ProfileIr --> Bundle
    Bundle --> Hashes
    Bundle --> Diffs
    Bundle --> Artifacts
    Bundle --> Validators
    Bundle --> Manifest
    Bundle --> Evidence
    Evidence --> Holmes
    Bundle --> Echo
    Bundle --> Continuum
    Bundle --> Jedit
    Bundle --> WarpTtd
    Bundle --> WesleyPostgres
```

Wesley preserves, binds, emits, and explains semantic law. It does not become
the owner of Echo runtime execution, Continuum family meaning, jedit product
behavior, warp-ttd transport behavior, or PostgreSQL semantics.

## Contract Bundle Model

The contract bundle is the durable conceptual unit.

```mermaid
erDiagram
    CONTRACT_BUNDLE ||--|| SHAPE_IR : contains
    CONTRACT_BUNDLE ||--|| LAW_IR : contains
    CONTRACT_BUNDLE ||--o| POLICY_PROFILE_IR : applies
    CONTRACT_BUNDLE ||--|| HASH_SET : records
    CONTRACT_BUNDLE ||--o{ GENERATED_ARTIFACT : emits
    CONTRACT_BUNDLE ||--o{ EVIDENCE_RECORD : supports
    LAW_IR ||--o{ LAW_ENTRY : contains
    LAW_ENTRY ||--|| SUBJECT_COORDINATE : binds
    LAW_ENTRY ||--o{ LAW_PROVENANCE : documents
    LAW_ENTRY ||--o{ LAW_TAG : classifies
    POLICY_PROFILE_IR ||--o{ POLICY_RULE : configures
    GENERATED_ARTIFACT ||--|| ARTIFACT_PROVENANCE : records
    EVIDENCE_RECORD ||--o{ JUDGMENT_INPUT : feeds

    CONTRACT_BUNDLE {
      string apiVersion
      string family
      string bundleHash
    }

    HASH_SET {
      string schemaHash
      string lawHash
      string profileHash
      string bundleHash
      string lawDocumentHash
    }

    LAW_ENTRY {
      string id
      string kind
      string subject
      string status
    }

    SUBJECT_COORDINATE {
      string coordinate
      string kind
      string schemaHash
    }
```

The bundle answers:

1. What structural shape was authored?
2. What semantic law was active?
3. What profile or policy was applied?
4. What hashes identify the exact inputs?
5. What artifacts were generated?
6. What evidence or witness data supports the result?
7. What changed since the previous bundle?

## Law IR v1 Shape

Law IR v1 is a closed, versioned model. It should be extensible by adding new
versioned variants, not by letting arbitrary `kind` strings pass through.

Conceptually:

```rust
enum LawKindV1 {
    ScalarSemantics(ScalarSemanticsLaw),
    VariantLaw(VariantLaw),
    FootprintLaw(FootprintLaw),
    ChannelLaw(ChannelLaw),
    InvariantLaw(InvariantLaw),
}
```

This is not a promise that the implementation must use this exact Rust shape.
It is the type discipline the compiler must enforce.

### Common Law Entry Fields

Every active law entry has:

| Field       | Meaning                                               | Hash posture                                     |
| ----------- | ----------------------------------------------------- | ------------------------------------------------ |
| `id`        | Stable law id.                                        | Semantic hash                                    |
| `kind`      | Closed Law IR variant.                                | Semantic hash                                    |
| `subject`   | Bound schema or law coordinate.                       | Semantic hash                                    |
| `status`    | `active` or `draft`; only active law affects bundles. | Semantic hash if active                          |
| `tags`      | Optional classification tags.                         | Semantic hash when semantically relevant         |
| `profiles`  | Optional profile applicability references.            | Profile hash or semantic hash depending on field |
| `rationale` | Human explanation.                                    | Document/provenance hash only                    |
| `source`    | Authored source span or path.                         | Excluded from semantic hash                      |

Draft entries may exist in files produced by `wesley init-law`, but they do not
bind into active bundles and do not affect generated artifacts.

## v1 Law Categories

### Scalar Semantics Law

Scalar semantics law captures representation, range, identity, ordering, and
preservation requirements that GraphQL scalar declarations cannot express.

Example:

```yaml
apiVersion: weslaw/v1
schema:
  family: echo-runtime-boundary
  hash: sha256:example-schema-hash
laws:
  - id: echo.scalar.positiveInt.u32-positive
    status: active
    kind: scalarSemantics
    subject: scalar:PositiveInt
    semantics:
      representation: integer
      minInclusive: 1
      maxInclusive: 4294967295
      forbids: [silentGraphQLIntNarrowing]
    rationale: >
      PositiveInt is a u32-domain runtime value. GraphQL Int narrowing would
      change the contract even though the visible scalar name stayed the same.
```

The `weslaw/v1` YAML frontend nests scalar-specific fields under `semantics`.
Lowering strips that authoring wrapper before producing the scalar Law IR body.

Compiler expectations:

- `subject` must bind to an existing scalar in the active schema hash.
- range and representation rules must be type checked.
- generated validators may consume these facts.
- semantic diffs must classify range narrowing, range widening, representation
  changes, and ordering changes.

### Variant Law

Variant law captures discriminated input envelopes and input-union stand-ins.

Example:

```yaml
apiVersion: weslaw/v1
schema:
  family: echo-runtime-boundary
  hash: sha256:example-schema-hash
laws:
  - id: echo.input.playbackMode.variant-rules
    status: active
    kind: variantLaw
    subject: input:PlaybackModeInput
    discriminator:
      field: kind
      enum: PlaybackModeKind
    cases:
      - value: PAUSED
        forbids: [target, then]
      - value: PLAY
        forbids: [target, then]
      - value: STEP_FORWARD
        forbids: [target, then]
      - value: STEP_BACK
        forbids: [target, then]
      - value: SEEK
        requires: [target, then]
```

Compiler expectations:

- the subject must bind to an input object;
- the discriminator field must exist on that input object;
- the discriminator enum must exist;
- every case value must bind to an enum value;
- required and forbidden fields must exist on the input object;
- a case may not both require and forbid the same field.

### Footprint Law

Footprint law captures operation access semantics: reads, writes, creates,
forbids, slots, closures, updates, and observed residue.

Example:

```yaml
apiVersion: weslaw/v1
schema:
  family: jedit-hot-text-runtime
  hash: sha256:example-schema-hash
laws:
  - id: jedit.op.replaceRangeAsTick.footprint
    status: active
    kind: footprintLaw
    subject: operation:Mutation.replaceRangeAsTick
    reads: [BufferWorldline, RopeHead, RopeBranch, RopeLeaf, TextBlob, Anchor]
    writes: [BufferWorldline]
    creates: [TextBlob, RopeLeaf, RopeBranch, RopeHead, Tick, TickReceipt]
    forbids: [AstState, Diagnostics, GitWitness, UiState]
    slots:
      - name: worldline
        kind: BufferWorldline
        bindFromArg: input.worldlineId
        access: [read, write]
      - name: baseHead
        kind: RopeHead
        bindFromArg: input.baseHeadId
        access: [read]
    closures:
      - name: touchedRope
        fromSlot: baseHead
        operator: ropeRangeClosure
        argBindings: [input.startByte, input.endByte]
        reads: [RopeBranch, RopeLeaf, TextBlob]
        cardinality: many
      - name: affectedAnchors
        fromSlot: worldline
        operator: anchorsIntersectingEditWindow
        argBindings: [baseHead, input.startByte, input.endByte]
        reads: [Anchor]
        cardinality: many
    createSlots:
      - name: newBlob
        kind: TextBlob
        cardinality: optional
      - name: nextHead
        kind: RopeHead
      - name: tick
        kind: Tick
      - name: receipt
        kind: TickReceipt
    updates:
      - slot: worldline
        fields: [canonicalHead]
```

Compiler expectations:

- the subject must bind to a root operation field;
- operation argument paths must bind to real input paths;
- resource kinds must bind to schema coordinates or explicit law registries;
- slot names must be unique within the footprint;
- updates must target writable slots;
- forbidden resource kinds must not appear in reads, writes, creates, or
  updates;
- footprint expansion and contraction must be reported as semantic diffs.

### Channel Law

Channel law captures protocol channels, ordering, version posture, and message
families.

Example:

```yaml
apiVersion: weslaw/v1
schema:
  family: warp-ttd-protocol
  hash: sha256:example-schema-hash
laws:
  - id: warp-ttd.channel.protocol.v4
    status: active
    kind: channelLaw
    subject: channel:ttd.protocol@4
    ordered: true
    version: 4
    compatibility:
      versioning: channel
      semverCoupled: false
    messages:
      - field: hostHello
        type: HostHello
      - field: laneCatalog
        type: LaneCatalog
      - field: playbackHeadSnapshot
        type: PlaybackHeadSnapshot
      - field: playbackFrame
        type: PlaybackFrame
      - field: receiptSummary
        type: ReceiptSummary
      - field: effectEmissionSummary
        type: EffectEmissionSummary
      - field: deliveryObservationSummary
        type: DeliveryObservationSummary
      - field: executionContext
        type: ExecutionContext
```

Compiler expectations:

- channel subjects must bind to known channel declarations from SDL directives
  or explicit law registries;
- message fields and message types must bind;
- channel version changes must be semantic diffs;
- ordered to unordered changes are semantic changes even when GraphQL shape is
  unchanged.

### Invariant Law

Invariant law is deliberately boring in v1.

v1 does not admit arbitrary executable string expressions. It supports typed
predicate forms and external verifier references.

Typed predicate example:

```yaml
apiVersion: weslaw/v1
schema:
  family: continuum-runtime-boundary
  hash: sha256:example-schema-hash
laws:
  - id: continuum.invariant.translated-evidence-not-native
    status: active
    kind: invariantLaw
    subject: type:TranslatedSubstrateEvidence
    predicate:
      op: fieldEquals
      field: nativeContinuumWitness
      value: false
```

External verifier example:

```yaml
apiVersion: weslaw/v1
schema:
  family: continuum-runtime-boundary
  hash: sha256:example-schema-hash
laws:
  - id: continuum.invariant.bundle-links-source-shell
    status: active
    kind: invariantLaw
    subject: family:continuum-runtime-boundary
    predicate:
      op: external
      verifier: continuum-law-checker
      ref: continuum.invariants.bundleLinksSourceShell
      inputContract: continuum.bundle-invariant-input.v1
```

Compiler expectations:

- typed predicates must be parsed as structured data;
- fields referenced by typed predicates must bind;
- external verifier ids must bind to explicit law registries;
- raw expression strings are rejected as executable v1 law.

## Deferred Law Categories

The following are valuable but should not block v1:

| Category                                | Why defer                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence posture law                    | Important for Continuum witness semantics, but less structurally concrete than scalar, variant, footprint, channel, and simple invariant law. |
| Profile-aware severity escalation       | Belongs in Policy/Profile IR; should not be confused with semantic truth.                                                                     |
| Generated test scaffolding              | Useful after residue and observation surfaces are stable.                                                                                     |
| Runtime capability APIs from footprints | High payoff, but depends on stable footprint IR and target-owned runtime adapters.                                                            |
| Law Matrix static site                  | Strong human legibility surface after `wesley law explain` and semantic diffs exist.                                                          |
| LSP support                             | Should use the same engine as `wesley law explain`; do not build it first.                                                                    |
| Wesley SDL+                             | Authoring sugar only after Law IR is stable.                                                                                                  |

## Binding Model

Strict binding is the difference between law and decoration.

### Binding Inputs

The binder receives:

- Shape IR;
- Law IR;
- optional policy/profile IR;
- explicit law registries for non-shape symbols;
- the active schema hash.

### Binding Rules

An active law entry must satisfy all applicable rules:

| Rule                                                          | Failure                       |
| ------------------------------------------------------------- | ----------------------------- |
| `schema.hash` equals active schema hash                       | `WESLAW_SCHEMA_HASH_MISMATCH` |
| `id` is globally unique in the bundle                         | `WESLAW_DUPLICATE_ID`         |
| `kind` is a known closed Law IR variant                       | `WESLAW_UNKNOWN_KIND`         |
| `subject` parses as a coordinate                              | `WESLAW_INVALID_COORDINATE`   |
| `subject` binds to an existing schema or law-registry subject | `WESLAW_UNRESOLVED_SUBJECT`   |
| `subject` kind matches law kind                               | `WESLAW_WRONG_SUBJECT_KIND`   |
| referenced fields, enum values, args, and resource kinds bind | `WESLAW_UNRESOLVED_REFERENCE` |
| entry does not contradict another active entry                | `WESLAW_CONFLICT`             |
| overlay refines instead of relaxes base law                   | `WESLAW_OVERLAY_RELAXATION`   |

Unknown active law is fatal. Unknown draft law may be retained outside the
active bundle as migration scaffolding.

### Diagnostic Shape

Diagnostics should be compiler-grade:

```text
error[WESLAW_UNRESOLVED_SUBJECT]:
  unresolved operation coordinate: operation:Mutation.replaceRange

  law:
    id: jedit.op.replaceRange.footprint
    file: schemas/jedit-hot-text.weslaw.yaml

  active schema:
    hash: sha256:...

  closest matches:
    operation:Mutation.replaceRangeAsTick
```

Diagnostics must name:

- error code;
- law id;
- subject coordinate;
- source path if available;
- active schema hash;
- closest matches when safe and deterministic.

## Schema Hash Anchoring And Rebind

Normal compilation is strict:

```text
law schema hash != active schema hash -> fail
```

That strictness prevents silent semantic drift. But Wesley also needs an
explicit migration workflow.

### Rebind Workflow

```text
wesley law rebind \
  --law schemas/hot-text.weslaw.yaml \
  --from-schema old.graphql \
  --to-schema new.graphql \
  --out schemas/hot-text.rebound.weslaw.yaml
```

The rebind report should classify each entry:

| Class          | Meaning                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------- |
| `unchanged`    | Subject and references bind identically under the new schema.                                |
| `rebuilt`      | Subject binds after a deterministic rename or coordinate migration supplied by the operator. |
| `broken`       | Subject or required references no longer bind.                                               |
| `needs-review` | Law still binds, but semantic surrounding shape changed enough to require human review.      |

Rebind updates schema hash anchors only when the operator explicitly accepts the
new binding result.

## Canonicalization And Hashing

Canonicalization is load-bearing. If semantically identical law hashes
differently because of key order or formatting, the system loses trust.

### Hash Inputs

| Hash              | Includes                                               | Excludes                                                        |
| ----------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| `schemaHash`      | canonical Shape IR                                     | comments, source spans, formatting                              |
| `lawHash`         | canonical active Law IR semantic fields                | comments, rationale, source spans, file order                   |
| `profileHash`     | canonical active Policy/Profile IR                     | environment variables, source spans                             |
| `bundleHash`      | schemaHash + lawHash + profileHash + compiler identity | prose docs, local paths unless intentionally part of provenance |
| `lawDocumentHash` | semantic law plus rationale/provenance text            | transient source spans                                          |

### Ordering Rules

v1 must define deterministic ordering:

- law entries sort by stable `id`;
- maps sort lexicographically by key;
- set-like arrays sort lexicographically after duplicate rejection;
- order-sensitive arrays remain order-sensitive and are declared as such in the
  IR spec;
- omitted defaults canonicalize to explicit defaults;
- comments never enter semantic hashes;
- file load order does not affect semantic hashes.

### Canonical Bytes

The canonical codec should be named explicitly:

```text
wesley.law-ir.canonical-json.v1
```

The codec owns:

- object key order;
- numeric representation;
- string escaping;
- default materialization;
- null omission rules;
- array semantics.

### Published Schemas

`weslaw` is a compiler contract, not an undocumented Rust struct. Every
externally consumed representation needs a schema artifact.

Initial schema artifacts:

| Artifact                                 | Status                        | Purpose                                                    |
| ---------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `schemas/wesley-law-ir-v1.schema.json`   | v1 implementation requirement | JSON Schema for typed Law IR v1 JSON.                      |
| `schemas/weslaw-v1.schema.json`          | v1 implementation requirement | JSON Schema for the parsed `weslaw/v1` authoring document. |
| `schemas/wesley-law-diff-v1.schema.json` | diff phase requirement        | JSON Schema for machine-readable law diff events.          |

These schemas validate public structure. They are not semantic hash inputs.
Changing comments, descriptions, `$id`, or schema annotations must not change
`lawHash` unless the underlying Law IR semantics also change.

The `weslaw/v1` authoring schema accepts explicitly marked draft scaffolding
with future or ambiguous fields, but the normalized `wesley.law-ir/v1` schema
rejects draft entries entirely. Promotion to active law is therefore the point
where closed kind/body validation becomes mandatory.

JSON is acceptable as the first schema-authoring format, but the design should
not freeze the project there. The open implementation choice is how Rust owns
these schema artifacts over time:

- handwritten schemas checked into `schemas/`;
- generated schemas from Rust types with checked-in outputs;
- generated Rust types from checked-in schemas.

The requirement to publish schemas is not open.

## Semantic Diff Model

Law diffs are first-class outputs. Human summaries are generated from
machine-readable diff events.

```mermaid
sequenceDiagram
    participant Old as Old Bundle
    participant New as New Bundle
    participant Diff as Law Diff Engine
    participant CI as CI Reporter
    participant Holmes as Holmes/BLADE

    Old->>Diff: Shape IR + Law IR + hashes
    New->>Diff: Shape IR + Law IR + hashes
    Diff->>Diff: classify semantic changes
    Diff->>CI: markdown summary
    Diff->>Holmes: JSON diff events
```

v1 diff event classes:

| Event                     | Meaning                                              |
| ------------------------- | ---------------------------------------------------- |
| `LAW_ADDED`               | New active law entry.                                |
| `LAW_REMOVED`             | Active law entry removed.                            |
| `LAW_STRENGTHENED`        | Constraint narrowed or forbidden behavior increased. |
| `LAW_WEAKENED`            | Constraint widened or forbidden behavior decreased.  |
| `FOOTPRINT_EXPANDED`      | Reads, writes, creates, or closure reach expanded.   |
| `FOOTPRINT_CONTRACTED`    | Footprint reach contracted.                          |
| `CHANNEL_VERSION_CHANGED` | Channel version or compatibility posture changed.    |
| `BINDING_BROKEN`          | Previously bound law no longer binds.                |
| `SCHEMA_HASH_REBOUND`     | Law was explicitly rebound to a new schema hash.     |
| `PREDICATE_CHANGED`       | Invariant predicate changed.                         |

Example JSON:

```json
{
  "apiVersion": "wesley.law-diff/v1",
  "changes": [
    {
      "kind": "FOOTPRINT_EXPANDED",
      "lawId": "jedit.op.replaceRangeAsTick.footprint",
      "subject": "operation:Mutation.replaceRangeAsTick",
      "addedWrites": ["Diagnostics"],
      "reviewPosture": "requires-review"
    }
  ]
}
```

Example human summary:

```text
This PR changes operation:Mutation.replaceRangeAsTick by expanding its write
footprint to include Diagnostics.
```

## Policy And Profiles

Semantic law says what is true about the contract. Policy says what to do with
that truth in a context.

Do not collapse them.

```mermaid
flowchart LR
    Law[Semantic Law]
    Policy[Policy/Profile]
    Evidence[Evidence]
    Judgment[Judgment]

    Law --> Evidence
    Law --> Policy
    Policy --> Judgment
    Evidence --> Judgment

    LawText[PositiveInt min=1 max=4294967295]
    PolicyText[release treats violation as error]
    EvidenceText[validator generated and tested]
    JudgmentText[release-ready yes/no]

    Law --> LawText
    Policy --> PolicyText
    Evidence --> EvidenceText
    Judgment --> JudgmentText
```

Examples:

| Layer    | Example                                                                 |
| -------- | ----------------------------------------------------------------------- |
| Law      | `PlaybackModeInput SEEK requires target and then`.                      |
| Policy   | `release profile treats missing variant coverage as error`.             |
| Evidence | `TypeScript and Rust validators generated from lawHash abc`.            |
| Judgment | `Holmes says release gate passes because validators and witness exist`. |

Profiles must be explicit. No v1 behavior may infer profile from ambient
environment variables.

## Overlays

Overlays are useful but dangerous. They let shared law be refined by product,
deployment, or app-specific context.

Allowed overlay refinements:

- narrow scalar ranges;
- add forbidden resources;
- require more evidence;
- add stricter variant case requirements;
- add stricter footprint access limits;
- increase policy severity.

Forbidden overlay relaxations:

- widen scalar ranges;
- remove forbidden resources;
- downgrade base policy without explicit override authority;
- contradict invariants;
- change channel ordering;
- remove required variant fields.

Overlays should not ship in v1 unless the monotonic refinement checker ships
with them. Otherwise overlays become a vocabulary for weakening base truth.

## Frontends

### weslaw YAML v1

YAML is the first authoring frontend because it is simple to inspect and easy
to scaffold. It is not canonical.

Minimal shape:

```yaml
apiVersion: weslaw/v1
schema:
  family: example-family
  hash: sha256:example-schema-hash
  source: schemas/example.graphql
laws:
  - id: example.scalar.id.opaque
    status: active
    kind: scalarSemantics
    subject: scalar:ExampleId
    semantics:
      representation: opaqueIdentifier
```

### Known Wesley Directives

Known formal directives may lower directly into Law IR when their semantics are
specified and typed.

Examples:

- formal `@wes_footprint` payloads may lower to `FootprintLaw`;
- formal `@wes_channel` payloads may lower to `ChannelLaw`;
- formal compact scalar directives may lower to `ScalarSemanticsLaw` if
  designed later.

Known but stringly or underspecified directives should lower to provisional
drafts or external verifier references instead of executable law.

### Comments

Comments may inspire law. Comments are not law.

`wesley init-law` may read comments and propose draft entries, but human review
must promote them before they affect Law IR, hashes, generated artifacts, or
judgment.

### Wesley SDL+

Wesley SDL+ is explicitly not v1.

It may become an ergonomic authoring syntax after:

- Law IR v1 is stable;
- binding diagnostics are useful;
- canonical hashes are stable across formatting changes;
- semantic diffs produce useful CI output;
- at least two contract families use companion law successfully.

SDL+ must only lower into GraphQL SDL plus Law IR. It must never become a third
truth source.

## CLI Surface

The CLI should grow in layers.

### `wesley law lint`

Fast local structure check without full schema compilation:

- YAML shape;
- duplicate ids in one file;
- invalid kind names;
- invalid coordinate syntax;
- unknown fields;
- draft entries;
- style and naming checks.

### `wesley law validate`

Full compiler validation:

- schema hash match;
- subject binding;
- reference binding;
- conflict detection;
- overlay refinement;
- canonical hash calculation.

### `wesley law diff`

Structured semantic diff between two bundles or law sets.

Output formats:

- JSON for Holmes/BLADE/Moriarty/CI consumers;
- Markdown for PR comments;
- terminal text for operators.

### `wesley law explain`

Human-readable explanation for one subject:

```text
wesley law explain operation:Mutation.replaceRangeAsTick
```

Expected output:

- subject;
- bound laws;
- reads/writes/creates/forbids;
- variants or scalar rules if relevant;
- source law ids;
- generated artifact implications;
- policy/profile posture if supplied.

`wesley law explain` should become the shared engine for future LSP hover
support and the Law Matrix static site.

### `wesley init-law`

Scaffolds law from existing inputs after Law IR, binding, and canonicalization
are defined.

Inputs:

- GraphQL SDL;
- known formal directives;
- optional comments for suggestions only;
- optional module-specific directive registries.

Outputs:

- active law for formal known directives;
- draft law for comments and ambiguous directives;
- a migration report showing what was promoted, suggested, or skipped.

### `wesley law rebind`

Explicitly revalidates law against a new schema hash and produces a report.

No normal compile path silently updates schema anchors.

## Generated Artifacts

Generated artifacts should carry active contract identity.

Rust example:

```rust
pub const WESLEY_SCHEMA_HASH: &str = "sha256:...";
pub const WESLAW_HASH: &str = "sha256:...";
pub const WESLEY_PROFILE_HASH: &str = "sha256:...";
pub const WESLEY_BUNDLE_HASH: &str = "sha256:...";
```

TypeScript example:

```ts
export const WESLEY_SCHEMA_HASH = 'sha256:...';
export const WESLAW_HASH = 'sha256:...';
export const WESLEY_PROFILE_HASH = 'sha256:...';
export const WESLEY_BUNDLE_HASH = 'sha256:...';
```

That gives generated artifacts cryptographic traceability to the exact shape,
law, and profile that produced them.

## Known Failure Paths

```mermaid
flowchart TD
    Start[Compile Contract Bundle]
    SchemaMismatch{Schema hash matches?}
    BindSubjects{All active subjects bind?}
    KindValid{Law kinds known?}
    RefsBind{All references bind?}
    ConflictFree{No conflicts?}
    OverlayValid{Overlays monotonic?}
    Canon[Canonicalize]
    Success[Bundle emitted]

    Start --> SchemaMismatch
    SchemaMismatch -- no --> E1[WESLAW_SCHEMA_HASH_MISMATCH]
    SchemaMismatch -- yes --> KindValid
    KindValid -- no --> E2[WESLAW_UNKNOWN_KIND]
    KindValid -- yes --> BindSubjects
    BindSubjects -- no --> E3[WESLAW_UNRESOLVED_SUBJECT]
    BindSubjects -- yes --> RefsBind
    RefsBind -- no --> E4[WESLAW_UNRESOLVED_REFERENCE]
    RefsBind -- yes --> ConflictFree
    ConflictFree -- no --> E5[WESLAW_CONFLICT]
    ConflictFree -- yes --> OverlayValid
    OverlayValid -- no --> E6[WESLAW_OVERLAY_RELAXATION]
    OverlayValid -- yes --> Canon
    Canon --> Success
```

Failure must be loud and structured. Silent law dropping is worse than no law
layer because it creates false confidence.

## Migration Path

### Phase 0: Design Lock

- Publish this packet.
- Publish Law IR v1 schema.
- Name non-goals and failure codes.

### Phase 1: Loader, Binder, Canonicalizer

- Parse `weslaw/v1` YAML.
- Bind subjects to Shape IR and law registries.
- Enforce schema hash anchoring.
- Produce canonical Law IR bytes and `lawHash`.

### Phase 2: Known Directive Lowering

- Lower formal, typed Wesley directives into Law IR.
- Leave comments and ambiguous/stringly directives as provisional suggestions.
- Add tests proving directive-lowered law and YAML-authored law canonicalize to
  the same Law IR.

### Phase 3: Diffs And Manifest

- Add machine-readable law diff events.
- Add human summaries generated from structured diffs.
- Add `schemaHash`, `lawHash`, `profileHash`, and `bundleHash` to generated
  manifests.

### Phase 4: Adoption Tooling

- Add `wesley init-law`.
- Add `wesley law lint`.
- Add `wesley law validate`.
- Add `wesley law explain`.
- Add `wesley law rebind`.

### Phase 5: Downstream Consumers

- Let emitters consume scalar and variant law.
- Let footprint law feed generated capability surfaces where target owners opt
  in.
- Let Holmes/BLADE consume machine-readable semantic diffs and bundle hashes.
- Consider Law Matrix and LSP support after CLI explain output stabilizes.

## Implementation Slices

Working budget: **75 slices**.

The budget is intentionally larger than the minimal compiler substrate because
`weslaw` must become an operator-usable contract-bundle feature, not just an
internal parser. Re-estimate after `WLAW-050` before committing to the final
v1/v1.1 boundary.

### Phase 0: Design Lock

- [x] WLAW-001 Publish the Law IR v1 schema note as a closed, versioned model.
- [x] WLAW-002 Define the subject coordinate grammar for schema and law
      subjects.
- [x] WLAW-003 Define the non-shape law registry model for resources,
      verifiers, channels, and capability domains.
- [x] WLAW-004 Define the law file discovery rules and explicit
      schema-hash-anchor rules.
- [x] WLAW-005 Define canonicalization rules for ordering, defaults, comments,
      source spans, set-like arrays, and order-sensitive arrays.
- [x] WLAW-006 Define the v1 diagnostic catalog and stable error codes.
- [x] WLAW-007 Define active versus draft law semantics.
- [x] WLAW-008 Define the v1 fixture corpus for accepted and rejected law
      documents.
- [x] WLAW-009 Add the first `weslaw/v1` examples for scalar, variant,
      footprint, channel, and typed invariant law.
- [x] WLAW-010 Update docs and changelog with the locked v1 substrate scope.

### Phase 1: Law Loader And Typed IR

- [x] WLAW-011 Add Rust Law IR v1 types for common law entry metadata.
- [x] WLAW-012 Add Rust Law IR v1 types for `ScalarSemanticsLaw`.
- [x] WLAW-013 Add Rust Law IR v1 types for `VariantLaw`.
- [x] WLAW-014 Add Rust Law IR v1 types for `FootprintLaw`.
- [x] WLAW-015 Add Rust Law IR v1 types for `ChannelLaw`.
- [x] WLAW-016 Add Rust Law IR v1 types for typed `InvariantLaw`.
- [x] WLAW-017 Parse `weslaw/v1` YAML through the v1 structure loader and
      publish the initial `weslaw/v1` authoring schema artifact.
- [x] WLAW-018 Normalize loader output into typed Law IR.
- [x] WLAW-019 Reject unknown active law kinds and unknown active fields with stable
      diagnostics.
- [x] WLAW-020 Add fixture tests proving accepted YAML lowers into typed Law
      IR and the accepted fixtures satisfy the published authoring schema.

### Phase 2: Strict Binding

- [ ] WLAW-021 Parse and validate schema-hash anchors.
- [ ] WLAW-022 Fail loudly on schema-hash mismatch.
- [ ] WLAW-023 Bind scalar subjects to Shape IR.
- [ ] WLAW-024 Bind type, input, enum, and field subjects to Shape IR.
- [ ] WLAW-025 Bind operation subjects to root operation fields.
- [ ] WLAW-026 Bind variant discriminator fields and enum values.
- [ ] WLAW-027 Bind footprint argument paths to operation input paths.
- [ ] WLAW-028 Bind footprint resource kinds through schema coordinates or
      explicit law registries.
- [ ] WLAW-029 Bind channel subjects through known directives or law
      registries.
- [ ] WLAW-030 Bind typed invariant field references.
- [ ] WLAW-031 Reject duplicate law ids across the active bundle.
- [ ] WLAW-032 Reject wrong subject kind for each Law IR variant.
- [ ] WLAW-033 Reject contradictory law entries in the same bundle.
- [ ] WLAW-034 Add closest-match diagnostics for unresolved schema
      coordinates.
- [ ] WLAW-035 Add `wesley law validate` for full schema-bound validation.

### Phase 3: Canonicalization And Hashes

- [ ] WLAW-036 Implement canonical Law IR serialization.
- [ ] WLAW-037 Compute `lawHash` from active semantic Law IR only.
- [ ] WLAW-038 Exclude comments, source spans, and rationale prose from
      `lawHash`.
- [ ] WLAW-039 Compute optional `lawDocumentHash` for provenance-bearing
      documents.
- [ ] WLAW-040 Add canonicalization fixtures for key order and file-order
      independence.
- [ ] WLAW-041 Add canonicalization fixtures for omitted defaults versus
      explicit defaults.
- [ ] WLAW-042 Add canonicalization fixtures for set-like and order-sensitive
      arrays.
- [ ] WLAW-043 Add bundle manifest fields for `schemaHash`, `lawHash`,
      `profileHash`, and `bundleHash`.
- [ ] WLAW-044 Embed schema and law hash constants in one generated artifact
      path.
- [ ] WLAW-045 Update docs and changelog for canonical law hash behavior.

### Phase 4: Semantic Diffs

- [ ] WLAW-046 Define `wesley.law-diff/v1` JSON output.
- [ ] WLAW-047 Emit scalar semantic diff events.
- [ ] WLAW-048 Emit variant law diff events.
- [ ] WLAW-049 Emit footprint law diff events.
- [ ] WLAW-050 Drift checkpoint: reassess scope, split v1/v1.1 if needed, and
      update this checklist before continuing.
- [ ] WLAW-051 Emit channel law diff events.
- [ ] WLAW-052 Emit typed invariant diff events.
- [ ] WLAW-053 Add `LAW_STRENGTHENED` and `LAW_WEAKENED` classifications.
- [ ] WLAW-054 Add `BINDING_BROKEN` and `SCHEMA_HASH_REBOUND`
      classifications.
- [ ] WLAW-055 Add `wesley law diff --json`.
- [ ] WLAW-056 Generate Markdown summaries from structured diff events.
- [ ] WLAW-057 Add CI-ready semantic diff fixture output.
- [ ] WLAW-058 Add Holmes/BLADE-facing semantic diff fixtures.
- [ ] WLAW-059 Update docs and changelog for law diff output.

### Phase 5: Directive Lowering And Adoption Tools

- [ ] WLAW-060 Lower one known formal directive family into Law IR.
- [ ] WLAW-061 Prove directive-authored and YAML-authored law canonicalize to
      the same Law IR.
- [ ] WLAW-062 Add `wesley law lint` for structure-only validation.
- [ ] WLAW-063 Add `wesley init-law` scaffolding from known formal directives.
- [ ] WLAW-064 Add comment-derived draft suggestions with mandatory human
      promotion.
- [ ] WLAW-065 Add `wesley law explain scalar:<Name>`.
- [ ] WLAW-066 Add `wesley law explain operation:<Root>.<Field>`.
- [ ] WLAW-067 Add `wesley law rebind` report generation.
- [ ] WLAW-068 Add explicit rebind acceptance flow for schema-hash anchor
      updates.
- [ ] WLAW-069 Update docs and changelog for law authoring and adoption
      workflows.

### Phase 6: First Consumer Payoff

- [ ] WLAW-070 Generate scalar validators for one retained emitter or module
      target.
- [ ] WLAW-071 Generate variant validators for one retained emitter or module
      target.
- [ ] WLAW-072 Emit first footprint-to-capability report without claiming
      runtime enforcement.
- [ ] WLAW-073 Add profile/category-aware law coverage reporting.
- [ ] WLAW-074 Add a minimal Law Matrix static report prototype or defer it
      explicitly to v1.1 with evidence.
- [ ] WLAW-075 Close the v1 packet with playback, retrospective, docs,
      changelog, and release-readiness evidence.

## Non-Goals

- Do not replace GraphQL SDL.
- Do not introduce Wesley SDL+ in v1.
- Do not make YAML executable.
- Do not create a bespoke expression language.
- Do not use raw CEL, Rego, or other expression strings without normalized
  parsing, typing, binding, and hashing rules.
- Do not let `weslaw` introduce structural GraphQL shape.
- Do not make `weslaw` a junk drawer for ownership, release notes, TODOs,
  deployment scripts, or style preferences.
- Do not auto-promote comments into active law.
- Do not silently apply law to a mismatched schema hash.
- Do not implement overlays without monotonic refinement checks.

## Open Decisions

1. Which schema-artifact ownership model should the Rust implementation use:
   handwritten schemas checked into `schemas/`, schemas generated from Rust
   types, or Rust types generated from checked-in schemas?
2. Should evidence posture enter v1, or wait for v1.1 after scalar, variant,
   footprint, channel, and typed invariant law prove the model?
3. Which known directive family should be lowered first?
4. Which target should receive the first generated scalar/variant validators?
5. Should bundle manifests record both `compilerVersion` and canonicalization
   codec version separately?
6. Should `lawDocumentHash` be emitted by default or only when provenance
   output is requested?

## Sensei Rule

GraphQL is the map. `weslaw` is the physics. The contract bundle is the thing
Wesley compiles.

The first implementation must be typed, deterministic, and boring enough to
trust.
