---
title: 'SPEC - Edict Language v1'
legend: 'SPEC|TRANSMUTE|PLATFORM'
lane: 'design'
packet: '0021-continuum-yolo-runtime-neutral-edict-sha-lock-assurance'
issue: 'https://github.com/flyingrobots/wesley/issues/611'
status: 'draft'
owners:
  - '@flyingrobots'
created: '2026-06-17'
updated: '2026-06-17'
---

<!-- markdownlint-disable MD025 -->

# SPEC - Edict Language v1

<!-- markdownlint-enable MD025 -->

## Linked Issue

- [Issue #611 - runtime-neutral Continuum target profiles](https://github.com/flyingrobots/wesley/issues/611)

## Source Material

This specification distills the Edict language plan from:

- `docs/design/0021-continuum-yolo-runtime-neutral-edict-sha-lock-assurance/continuum-yolo-runtime-neutral-edict-sha-lock-assurance.md`
- `/Users/james/git/blog/continuum-yolo-edict-runtime-neutral-design.md`
- `/Users/james/git/blog/continuum-yolo-edict-shalock-holmes-design.md`
- [PR #610](https://github.com/flyingrobots/wesley/pull/610)
- [Issue #611](https://github.com/flyingrobots/wesley/issues/611)

The two blog drafts are byte-identical as of this writing. PR #610 landed the
runtime-neutral packet. Issue #611 is the active implementation tracker.

## Decision Summary

Edict v1 is a restricted deterministic source language for lawful operations.
It compiles to Edict Core IR, a runtime-neutral canonical operation IR with
explicit target imports and analyzable effects. Edict Core does not contain
graph, commit, SQL, KV, event-log, filesystem, network, clock, random, or host
callback primitives. Runtime target profiles provide target intrinsics,
footprint algebra, target IR lowering, verifier rules, obstruction taxonomy,
and bundle profile semantics.

Wesley should compile Edict through a source-profile adapter and canonical IR
pipeline, but Wesley must not become the owner of Continuum participant policy,
Echo DPO, or target admission. The primary Edict language implementation should
eventually live in its own repository, with Wesley consuming it as a compiler
component and with Echo, Continuum, and other runtimes owning their target
profiles.

## Autonomous Operation Lane Terminology

The formal Edict/Continuum assurance lane for checked autonomous execution is
`lawful-autonomous`. The canonical identifier is:

```text
continuum.lane.lawful-autonomous/v1
```

Some design packets and human-facing materials may use the codename **YOLO**,
expanded as **You Only Lawfully Operate**, to contrast Edict's model with common
agent "YOLO mode" behavior. The codename is non-authoritative. Provenance
records, contract bundles, admission receipts, target profiles, canonical
coordinates, and canonical hashes use the formal lane identifier, not the
codename.

A lawful-autonomous operation does not imply approval bypass, ambient host
authority, raw filesystem or network access, unchecked callbacks, or unsandboxed
execution. It means the operation may run autonomously only after its source,
Core IR, target IR, lawpacks, target profile, verifier reports, generated
artifacts, and admission evidence are locked and accepted by participant policy.

Canonical bundle metadata should therefore use formal identifiers plus optional
display metadata:

```json
{
  "assuranceLane": "continuum.lane.lawful-autonomous/v1",
  "display": {
    "codename": "YOLO",
    "expansion": "You Only Lawfully Operate"
  }
}
```

Codename terms must not appear in hash-significant canonical coordinates. For
example, `continuum.yolo.bundle/v1`, `edict.yolo.profile/v1`, and
`target.yolo.safe/v1` are invalid canonical coordinates; use names such as
`continuum.bundle.lawful-autonomous/v1` or
`edict.assurance.checked-autonomous/v1` instead.

## Recommendation

### Primary Home

Create a dedicated Edict repository for the language specification, parser,
AST, Edict Core IR, canonicalization rules, conformance fixtures, and
runtime-neutral compiler tests.

Recommended eventual repository:

```text
flyingrobots/edict
```

### Wesley Role

Wesley should host the current design packet and may temporarily host bootstrap
adapters while the language hardens. Its durable role should be:

- GraphQL SDL to Shape IR.
- `weslaw` to Law IR.
- `graphql-wesley@1` source-profile facts for Edict compilation.
- Source-profile adapter plumbing, canonical hashing, manifests, and generic
  compiler evidence.
- Integration tests proving Edict source can consume Wesley Shape IR and Law IR
  without making Wesley own runtime behavior.

Wesley must not own Echo operation IDs, Echo DPO semantics, Continuum agent
policy, participant registration policy, or target-specific verifier semantics.

### Continuum Role

Continuum should own participant protocol:

- participant descriptors;
- source-profile catalogs;
- lawpack catalogs;
- runtime-target catalogs;
- capability catalogs;
- bundle preflight and registration APIs;
- admission receipts and obstruction classes.

Continuum should not own the Edict compiler as hidden runtime policy. It should
accept SHA-locked Edict bundles and verify them against participant policy.

### Echo Role

Echo should own `echo.dpo@1`:

- Echo target profile manifest;
- Echo target intrinsics;
- Echo graph footprint algebra;
- Echo Span IR lowering;
- Echo DPO verifier;
- Echo operation IDs and registration artifacts.

Echo must not define Edict Core. Making Echo the language home would relapse
into graph-shaped Continuum.

### Why Not Put Edict Primarily In Wesley

Wesley is the GraphQL-to-compiler-evidence substrate. Edict is a new lawful
operation language that may be authored without GraphQL and may target runtimes
that do not use Wesley Shape IR. Putting Edict primarily in Wesley would blur
the domain-empty boundary and pressure Wesley core to own Continuum and runtime
target semantics.

### Why Not Put Edict Primarily In Continuum

Continuum is the participant protocol and lawful self-extension workflow.
Bundling the compiler into Continuum would make participant policy and language
semantics harder to version independently. Edict should be a participant-
discoverable source profile, not the Continuum protocol itself.

### Why Not Put Edict Primarily In Echo

Echo is the first concrete target profile, not the universal storage model.
Putting Edict in Echo would make graph DPO doctrine look like the semantic
core and would contradict the packet rule: no universal store, universal law
shape.

## Language Layers

Edict has four separable layers.

### 1. Edict Source

Human and agent authored syntax. It declares packages, imports, types, pure
functions, intents, assertions, and target intrinsic calls. Migration and
projection syntax is reserved for future versions; v1 expresses migrations as
ordinary intents with a migration profile.

### 2. Edict Core IR

Canonical runtime-neutral IR produced from Edict Source or another accepted
source profile. It records typed declarations, normalized expressions,
effectful operation bodies, imports, law/profile references, and inferred
abstract effects.

### 3. Target IR

Runtime-specific IR produced by a target profile. Examples include Echo
Span IR, git-warp Commit/Reducer IR, KV Transaction/CAS IR, and EventLog
Append/Projection IR.

### 4. Contract Bundle

SHA-locked release artifact binding source hash, Core IR hash, target IR
hash, lawpack digests, target profile digest, verifier reports, generated
artifact hashes, assurance evidence, signatures, and admission metadata.

## Threat Model

Edict exists because agents and applications should be able to author lawful
operations without receiving raw runtime authority. The spec must therefore
defend against semantic substitution, supply-chain substitution, and authority
laundering before it defends syntax comfort.

Minimum attack classes:

- target profile substitution;
- stale lawpack downgrade;
- digest mismatch;
- source-profile confusion;
- target-lowering plugin nondeterminism;
- canonicalization ambiguity;
- JSON integer ambiguity;
- FIDLAR laundering through lawpack or native helpers;
- footprint underclaiming;
- closure-read underclaiming;
- read-only claims hiding writes, appends, or audit records;
- obstruction misclassified as compiler or admission error;
- host callback injection;
- plugin dependency confusion;
- replay of an old bundle under new participant policy;
- source-map spoofing;
- generated artifact tampering;
- conformance fixture forgery.

Threat response is layered:

- Core has no storage-shaped nouns.
- All effects are imported effects.
- Canonical values hash through one authoritative typed encoding.
- Target lowerers and verifiers are digest-locked executable components.
- Bundles carry source, Core IR, target IR, compiler, lowerer, verifier,
  lawpack, target profile, generated artifact, participant policy, and assurance
  evidence digests.
- Read-only, footprint, and cost claims are theorems checked from inferred
  effects and budgets, not trusted labels.

## Canonical Value Model

Grammar is not the authority boundary. Canonical value semantics are. The
compiler must define:

- integer width and signedness;
- enum coordinate encoding;
- option encoding;
- variant tag encoding;
- record field order;
- map key order;
- bytes encoding;
- string normalization policy;
- digest domain separation;
- absent versus null;
- imported type identity;
- source-profile type alias identity.

Edict v1 should separate abstract value semantics from review rendering:

```text
edict.canonical-value/v1  # abstract typed value model
edict.canonical-cbor/v1   # authoritative hash input
edict.canonical-json/v1   # review/debug rendering
```

`edict.canonical-cbor/v1` is the recommended authoritative hash input because
Edict needs typed cryptographic material, deterministic map ordering, explicit
integer widths, bytes, and a way to avoid JSON number ambiguity. JSON may still
be emitted as a canonical review form, but full-width `I64` and `U64` values
must not rely on plain JSON number semantics.

Every digest has a domain-separated label:

```text
hash(domain: "edict.core.module/v1", bytes: canonical-cbor(module))
hash(domain: "edict.target-ir/echo.span-ir/v1", bytes: canonical-cbor(target))
hash(domain: "edict.bundle/continuum.contract-bundle/v1", bytes: canonical-cbor(bundle))
```

Artifact hashing is an internal canonicalization operation over typed canonical
bytes. Source-level `hash(label, value...)` is a deterministic prelude helper
with stricter ergonomics: `label` must be a string literal, not a dynamic value,
and the call lowers to a domain-separated artifact hash over the canonical
encoding of `{ label, values }`.

## Authority Model

Core contains laws of physics, not furniture. Storage-shaped nouns enter the
program only through imports.

All effects are imported effects:

- target effects come from target profile imports;
- semantic effects come from lawpack imports;
- source-profile facts come from source-profile imports;
- pure helper functions come from Core, source, or digest-locked lawpack code.

There are no ambient Core effects. In particular, `record history.foo { ... }`
is not a Core event-store primitive. It is sugar for a lawpack semantic effect:

```edict
record history.textRangeReplaced {
  historyId: input.historyId,
};
```

desugars to:

```edict
let _ = history.textRangeReplaced.record({
  historyId: input.historyId,
});
```

The resulting Core effect records:

```text
authority: lawpack jedit.structural_history@1 digest sha256:...
intrinsic: jedit.structural_history@1.textRangeReplaced.record
effectKind: semantic.emit
```

If a semantic effect lowers to a durable event append, graph create, KV write,
or other runtime mutation, it is not read-only.

## Effect Evaluation Order

Edict v1 uses A-normal effect form. Effectful calls may appear only as:

```edict
let x = importedEffect(...);
importedEffect(...);
```

Effectful calls are rejected inside:

- function arguments;
- conditions;
- record literals;
- list literals;
- return expressions;
- pure helper bodies;
- other effect call arguments.

Rejected v1 example:

```edict
let z = hash(foo.read(), bar.create({ id: input.id }));
```

Required v1 form:

```edict
let fooValue = foo.read()
  else domain.FooMissing;
let barValue = bar.create({ id: input.id })
  else domain.BarConflict;
let z = hash(fooValue, barValue);
```

This rule keeps Core lowering simple: source lowers to a typed,
ANF/SSA-shaped Effect Core with ordered effect nodes, path predicates, and loop
cardinality bounds.

### Conditional Effect Values

A-normal effect form still needs a source construct for optional and conditional
effects. Edict v1 permits effectful branch expressions only in `let` binding
position:

```edict
let initialBlob = if len(initialBytes) == 0 {
  yield none<shape.TextBlob>();
} else {
  let blobRef = echo.ref<shape.TextBlob>(rope.textBlobId(initialBytes));
  let blob = blobRef.ensure({
    blobId: rope.textBlobId(initialBytes),
    encoding: shape.TextEncoding.UTF8,
    byteLength: len(initialBytes),
    contentHash: hash("TextBlob", initialBytes),
  }) else rope.TextBlobHashConflict;
  yield some(blob);
};
```

Rules:

- an effectful branch expression is legal only as the right-hand side of a
  `let`;
- each branch is an ANF block;
- each branch ends with `yield expr`;
- all branches yield the same type;
- effect calls inside branches obey normal A-normal rules;
- Core lowers the construct to a structured branch with a result binding;
- effects inside branches retain ordering and path predicates.

## Lawpack Semantic Effects

Portable semantic Edict is still effectful when it emits semantic facts. A
lawpack semantic effect may lower to different target effects on different
profiles, but Core must record the imported lawpack authority and the semantic
effect coordinate.

Semantic effects must declare:

- identity and digest of the owning lawpack;
- effect coordinate;
- input type;
- output type;
- whether the effect is proof-only or runtime-materialized;
- footprint summary or required target lowering obligations;
- cost summary or required target lowering obligations;
- obstruction taxonomy if the effect can fail at runtime.

Read-only claims must inspect semantic effects. A proof-only semantic fact may
be compatible with read-only; a semantic fact that lowers to an append, create,
replace, delete, audit write, or projection mutation is not.

## Target Symbolic References

Target source values must not be live runtime authority. They are symbolic plan
terms.

Recommended Echo-shaped model:

```edict
echo.ref<T>(id) -> EchoRef<T>
echo.ref<T>(id).read() -> T
echo.ref<T>(id).exists() -> Bool
echo.ref<T>(id).create(value: T) -> T
echo.ref<T>(id).ensure(value: T) -> T
echo.ref<T>(id).replace(value: T) -> T
echo.ref<T>(id).delete() -> Unit
echo.edge<A, B, E>(from: EchoRef<A>, to: EchoRef<B>).create(value: E) -> E
```

`EchoRef<T>` is inert, canonical, and hashable as a plan term. It cannot read,
write, or mutate unless an explicit imported effect is called.

Content-addressed immutable entities should usually use `ensure`, not
`create`:

- `create(value)` requires absence;
- `ensure(value)` creates if absent and otherwise requires the existing value
  to equal `value`;
- `replace(value)` requires presence and replaces the value;
- `delete()` requires presence;
- `upsert(value)` is not in Core v1 and should be target-specific if needed.

Prefer direct effect obstruction mapping over time-of-check/time-of-use
prechecks. For example, `create(...) else DomainAlreadyExists` is the preferred
v1 spelling when the only purpose of `exists()` would be to guard the create.

## Effect Failure Obstructions

Target and lawpack effects can fail at runtime even when source typechecks.
Source authors map effect failure classes to domain obstructions with an
effect-level `else` clause:

```edict
let worldline = worldlineRef.read()
  else rope.WorldlineMissing;

let worldline = worldlineRef.create({ ... })
  else rope.BufferWorldlineAlreadyExists;

let blob = blobRef.ensure({ ... })
  else rope.TextBlobHashConflict;

worldlineRef.replace(nextWorldline)
  else rope.StaleBaseHead;
```

The target profile owns the low-level failure taxonomy. The source obstruction
mapping must be checked against the target or lawpack effect signature. Core
effect nodes carry an obstruction map such as:

```text
obstructionMap:
  missing -> rope.WorldlineMissing
  conflict -> rope.BufferWorldlineAlreadyExists
  mismatch -> rope.TextBlobHashConflict
  staleGuard -> rope.StaleBaseHead
  boundExceeded -> rope.FootprintExceeded
```

`require predicate else Obstruction` remains useful for source-level invariants.
When the predicate protects mutable target state, lowering must attach it to the
relevant target effect as an atomic runtime guard rather than treating it as only
a local read-time assertion.

## Bounded Closure Reads

Closure reads are not safe merely because they are reads. Every target or
lawpack closure intrinsic must declare finite bounds or be rejected before a
locked bundle is produced.

Examples of required bound dimensions:

- maximum nodes;
- maximum bytes;
- maximum depth;
- maximum anchors;
- maximum branches;
- maximum leaves;
- maximum proof cost.

`textWindow` is a good positive fixture because its input naturally bounds
viewport lines, context lines, and bytes. A full-buffer `worldlineSnapshot`
without a type-level maximum or input maximum is a negative fixture until the
target/lawpack proves a finite bound.

## Cost Model

Footprint and cost are separate.

Footprint answers:

```text
What state may this touch?
```

Cost answers:

```text
How much work, memory, target IO, and output may this consume?
```

Every operation must have an inferred cost model checked against an admitted
budget. Minimal v1 budget fields:

```text
evaluationBudget:
  maxSteps
  maxAllocatedBytes
  maxOutputBytes
  maxTargetReads
  maxTargetWrites
  maxClosureReads
  maxGeneratedEffects
```

Pure lawpack helpers are also costed. A deterministic helper that can allocate
unbounded memory or scan unbounded input is not acceptable in the
lawful-autonomous lane.

## Development Mode Versus Locked Bundle Mode

Source may omit digests during development if a lockfile or local resolver can
resolve them. No contract bundle may contain floating imports.

Locked bundle production requires:

- source profile identity and digest;
- source content digest;
- source-profile canonical facts digest, when applicable;
- Shape IR digest for imported GraphQL shapes;
- Law IR digest for imported `weslaw`;
- every lawpack identity, version, and digest;
- every target profile identity, version, and digest;
- compiler identity and digest;
- target lowerer identity and digest;
- verifier identity and digest;
- compile options digest;
- conformance fixture digest set;
- participant descriptor digest;
- participant catalog snapshot digest;
- participant admission policy digest;
- participant admission policy epoch or monotonic policy version.

A path such as `contracts/jedit/rope.graphql` is a locator, not identity. The
bundle identity must use the content hash plus source-profile facts and
canonical Shape IR hash.

## Bundle Evidence And Transparency

Edict bundle evidence should use SLSA/in-toto-shaped vocabulary rather than
inventing opaque provenance names. Every locked bundle manifest must identify:

- materials: source files, lockfiles, shape facts, law facts, lawpacks, target
  profiles, compiler inputs, conformance fixtures;
- products: Core IR, target IR, generated artifacts, verifier reports,
  explanation artifacts, admission requests, and receipts;
- builder identity: compiler, lowerer, verifier, sandbox/runtime, and options;
- parameters: source profile, target profile, bundle profile, assurance lane,
  compile flags, fuel model, and budget model;
- policy evidence: participant descriptor digest, catalog snapshot digest,
  admission policy digest, and policy epoch.

Bundle digests, admission receipt digests, target profile digests, and lawpack
digests must be suitable for transparency-log publication. A v1 implementation
does not need to operate a global log, but bundle formats must leave room for
append-only log entries and Merkle consistency proofs.

## Query And Observer Operations

Read-only query operations are first-class lawful-autonomous operations. They
must carry the same source hash, Core IR hash, target profile, footprint, cost
budget, verifier result, generated artifacts, admission receipt, and obstruction
taxonomy as write operations.

Observer source sugar, if accepted by a frontend, must desugar to an `intent`
with a read-only source claim. The read-only claim remains inferential: writes,
appends, runtime-materialized semantic records, unbounded reads, or unchecked
costs reject the bundle.

## Capability Receipts

Opaque application handles are not ambient authority. A handle such as jedit's
`ReadBasisHandle` should be represented as a minted capability receipt:

```text
handleId
issuerBundleHash
scope
basis worldline/head or target-specific coordinate
capabilityKind
revocationPolicy
expiryPolicy
participantPolicyEpoch
```

Expiry must use explicit participant epochs or supplied provenance, not ambient
wall-clock time. Capability receipts are hash-bound evidence that can be
admitted, revoked, explained, and audited like other bundle artifacts.

## Bundle Nutrition Label

Every compiled operation must be able to emit a compact explanation artifact for
humans, agents, auditors, Watson, and Moriarty. Minimum fields:

```text
operation coordinate
operation mode
assurance lane
target profile
source hash
Core IR hash
target IR hash
reads and writes with bounds
budget
obstruction taxonomy and mappings
runtime guards
determinism proof status
floating imports
native plugins and sandbox identity
participant policy epoch
```

## Language Invariants

### I-001 Runtime Neutral Core

Edict Core contains no storage-native primitives. The following names are not
core built-ins:

- graph node, edge, attachment, span, DPO rule;
- git commit, ref, tree, path, merge base, reducer;
- SQL table, row, transaction, query;
- KV key, range, compare-and-swap;
- event stream, append, projection;
- filesystem path, network socket, process, thread, scheduler tick.

Any such concept must come from a target profile import.

### I-002 Explicit Target Authority

Every effectful target operation must be reachable through an explicit target
import:

```edict
use target echo.dpo@1 as echo;
```

No target intrinsic may be visible through prelude, ambient namespace, dynamic
lookup, reflection, or host callback injection.

### I-003 Determinism

The same source, source profile, lawpack digests, target profile digest,
compiler version, and compile options must produce byte-identical Core IR,
target IR, generated artifacts, and manifests.

Forbidden in the lawful-autonomous lane unless represented as explicit input or
provenance:

- wall-clock time;
- randomness;
- ambient environment;
- filesystem or network IO;
- locale-dependent comparison;
- nondeterministic map/set iteration;
- hidden actor or machine identity;
- global mutable state;
- reflection or `eval`;
- unconstrained recursion;
- unbounded loops.

### I-004 Total Bounded Evaluation

Pure Edict functions are total and cost-bounded over valid inputs. Loops must
be over finite collections with statically known or type-bounded maximum
cardinality. Recursive function calls are rejected in v1.

### I-005 Typed Effects

Every target intrinsic has a declared type and effect signature supplied by its
target profile. Every lawpack semantic effect has a declared type and effect
signature supplied by its lawpack. The compiler infers operation effects from
imported effects, not from author-declared footprint text.

### I-006 Footprint Honesty

Declared footprint bounds, when present, are policy ceilings:

```text
computedFootprint <= declaredMaxFootprint
```

Underclaiming rejects at compile time. Overclaiming may pass but reduces
admission and scheduling precision.

### I-007 FIDLAR Rejection

An Edict intent must not receive raw runtime mutation authority in the
lawful-autonomous lane. Privileged/native host extensions must use a separate
trust lane and must not claim compile-time footprint honesty unless they lower
to checked target IR with inferred effects.

### I-008 Lawpack And Profile Locking

All imported shapes, lawpacks, target profiles, lowerers, and verifiers must
resolve by identity, version where applicable, and digest before a locked
bundle is produced. A compile that resolves the same name to a different digest
must emit a mismatch diagnostic unless the author updates the lock.

### I-009 Canonical Names

Package, type, function, intent, field, profile, and import names normalize to
canonical coordinates. The canonical coordinate, not local alias spelling, is
used in Core IR hashes.

### I-010 Stable Core IR Hashes

Core IR hash input excludes source locations, comments, formatting, import
alias spelling, and nondeterministic map order. It includes all semantics:
resolved coordinates, type signatures, expressions, operation bodies,
preconditions, postconditions, imports, profile references, and effect model
references.

### I-011 Target Lowering Is Profile-Owned

Wesley or the Edict compiler may orchestrate target lowering, but the meaning
of the lowering is owned by the target profile and lawpack. Echo Span IR is
valid only for profiles that adopt Echo DPO semantics.

### I-012 Failure Class Separation

Edict preserves three failure classes:

- compiler error: invalid source, invalid Core IR, invalid lowering;
- registration/admission error: unsupported, stale, tampered, unsigned, or
  policy-rejected bundle;
- runtime obstruction: valid registered operation cannot apply to current
  runtime state.

### I-013 Schema Evolution Is Explicit

New required fields, changed operation ABIs, target profile revisions, lawpack
semantic changes, and bundle hash changes are separate version axes. The
compiler must not silently reinterpret old target IR under a new shape.

### I-014 Assurance Is Evidence, Not Authority

HOLMES, Watson, and Moriarty produce SHA-locked evidence and findings. They do
not mutate runtime state and do not override participant admission policy.

### I-015 Ordered Effect Nodes

All effectful source expressions lower to ordered Core effect nodes. Core does
not preserve nested effect expressions.

### I-016 Path Predicates And Bounds

Core IR preserves path predicates and loop cardinality bounds for every effect.
Conditional creates, bounded loops, and closure reads must remain visible to
footprint, cost, and target lowering.

### I-017 Imported Semantic Effects

Lawpack semantic records are imported semantic effects, not Core built-ins.
`record history.foo { ... }` is syntax sugar for a digest-locked lawpack
intrinsic.

### I-018 Read-Only Is Inferred

Read-only is a theorem proven from inferred effects. A source profile may claim
read-only posture, but the compiler must reject the claim if target or lawpack
effects include writes, appends, runtime-materialized semantic records, hidden
audit mutations, or other non-read effects.

### I-019 Bounded Closure Reads

Closure reads require finite profile-declared bounds. Unbounded closure reads
reject compilation or locked-bundle production.

### I-020 No Floating Bundle Imports

Development source may use floating imports only when a lockfile or local
resolver supplies exact digests. Contract bundles cannot contain floating
imports.

### I-021 Bounded Lawpack Helpers

Pure lawpack helpers must be deterministic, bounded, digest-locked, and
authority-free. Opaque helpers cannot contribute to precise compile-time
footprint honesty except through conservative declared bounds.

### I-022 Explicit Content-Addressed Creation

Content-addressed writes must choose `create`, `ensure`, `replace`, or
`delete` semantics explicitly. Duplicate content-addressed `create` is a
conflict unless the target profile defines an idempotent create profile.

### I-023 Runtime Guards For Mutable Assumptions

State assumptions that can change between read and apply must lower to runtime
guards in target IR. A source `require worldline.canonicalHeadId ==
baseHead.headId` is not only a local assertion; it must become a stale-basis
guard or equivalent target condition.

### I-024 Codenames Are Not Canonical Coordinates

Codename terms are non-authoritative display metadata. Hash-significant
coordinates, target profile identifiers, bundle profile identifiers, admission
receipts, and canonical hashes must use formal identifiers such as
`continuum.lane.lawful-autonomous/v1`, not codenames.

### I-025 Effect Failure Is Explicit

Imported effect failure classes must either map to typed domain obstructions or
be rejected by the compiler. Runtime effect failures must not collapse into
generic host exceptions.

### I-026 Conditional Effects Use Branch-Yield

Conditional effect values use `let x = if predicate { ... yield expr; } else {
... yield expr; };`. Nested effect calls inside pure expressions remain
rejected.

### I-027 Core Hashes Alpha-Normalize Locals

Local binder names are alpha-normalized in Core hash input. Source local names
may appear in review JSON or diagnostic sidecars but must not change the
hash-significant Core IR.

## Syntax Overview

An Edict source file declares one package and zero or more imports and
declarations:

```edict
package graft.structural_history@1;

use shape "schemas/structural-history.graphql" as shape;
use lawpack history.optics@1 digest "sha256:..." as history;
use target echo.dpo@1 digest "sha256:..." as echo;

type RecordGitWarpImportBatchInput = {
  basisId: shape.ID,
  repo: String,
  commit: Digest,
};

type RecordGitWarpImportBatchReceipt = {
  batchId: Digest,
};

intent recordGitWarpImportBatch(input: RecordGitWarpImportBatchInput)
  returns RecordGitWarpImportBatchReceipt
  profile echo.createOnly
  budget <= history.recordBatchBudget
  where input.repo != ""
{
  let basisRef = echo.ref<StructuralBasis>(input.basisId);
  let basis = basisRef.read()
    else history.StructuralBasisMissing;
  let batchId = hash("GitWarpImportBatch", input.repo, input.commit);

  let batchRef = echo.ref<GitWarpImportBatch>(batchId);
  let batch = batchRef.create({
    repo: input.repo,
    commit: input.commit,
  }) else history.GitWarpImportBatchAlreadyExists;

  echo.edge<GitWarpImportBatch, StructuralBasis, BasedOn>(
    batchRef,
    basisRef
  ).create({}) else history.BasedOnEdgeConflict;

  return { batchId };
}
```

Portable semantic Edict can target a lawpack instead of a concrete runtime:

```edict
package graft.structural_history@1;

use lawpack history.optics@1 digest "sha256:..." as history;

intent recordGitWarpImportBatch(input: RecordGitWarpImportBatchInput)
  returns RecordGitWarpImportBatchReceipt
  implements history.recordEntry
  budget <= history.recordBatchBudget
{
  let entry = history.entry.record({
    id: hash("GitWarpImportBatch", input.repo, input.commit),
    kind: "gitWarpImportBatch",
    repo: input.repo,
    commit: input.commit,
    basis: input.basisId,
  }) else history.EntryRecordObstructed;

  return { batchId: entry.id };
}
```

The portable form only compiles for a target when a lawpack supplies a lawful
lowering from the semantic operation to that target profile.

Source may also use `record history.entry { ... } else Obstruction;` sugar. That
sugar is not a Core primitive; it desugars to the lawpack semantic effect call
shown above.

## Lexical Rules

Edict source is UTF-8. Keywords and punctuation are ASCII. Identifiers use a
restricted portable subset in v1.

```ebnf
letter        = "A"..."Z" | "a"..."z" | "_" ;
digit         = "0"..."9" ;
hex           = digit | "A"..."F" | "a"..."f" ;
ident         = letter , { letter | digit } ;
upper-ident   = "A"..."Z" , { letter | digit } ;
qual-ident    = ident , { "." , ident } ;
version       = digit , { digit | "." | "-" | "_" | letter } ;
package-ref   = qual-ident , "@" , version ;
digest-lit    = '"' , "sha256:" , 64 * hex , '"' ;
string-lit    = '"' , { string-char | escape } , '"' ;
bytes-lit     = "b" , string-lit ;
int-lit       = digit , { digit | "_" } ;
bool-lit      = "true" | "false" ;
comment       = "//" , { not-newline } | "/*" , { not-end-comment } , "*/" ;
```

Whitespace and comments are not semantic. Source locations are retained for
diagnostics but excluded from canonical Core IR.

## Grammar

This grammar is normative for v1 syntax shape. Operator precedence and exact
tokenization will be pinned by parser conformance fixtures.

```ebnf
module          = package-decl , import-decl* , declaration* ;

package-decl    = "package" , package-ref , ";" ;

import-decl     = shape-import
                | lawpack-import
                | target-import
                | core-import ;

shape-import    = "use" , "shape" , string-lit , digest-clause? ,
                  "as" , ident , ";" ;
lawpack-import  = "use" , "lawpack" , package-ref , digest-clause? ,
                  "as" , ident , ";" ;
target-import   = "use" , "target" , package-ref , digest-clause? ,
                  "as" , ident , ";" ;
core-import     = "use" , "core" , package-ref , digest-clause? ,
                  "as" , ident , ";" ;
digest-clause   = "digest" , digest-lit ;

declaration     = type-decl
                | enum-decl
                | const-decl
                | fn-decl
                | intent-decl ;

bound-ref       = int-lit | qual-ident ;

type-decl       = "type" , upper-ident , type-params? ,
                  "=" , type-expr , ";" ;
enum-decl       = "enum" , upper-ident , "{" ,
                  enum-case , { "," , enum-case } , ","? , "}" ;
enum-case       = upper-ident ;
const-decl      = "const" , ident , ":" , type-ref , "=" , expr , ";" ;

type-params     = "<" , ident , { "," , ident } , ">" ;
type-expr       = record-type | variant-type | type-ref ;
record-type     = "{" , field-decl* , "}" ;
field-decl      = ident , ":" , type-ref , field-constraint* , ","? ;
field-constraint = "max" , "=" , bound-ref
                 | "min" , "=" , bound-ref
                 | "pattern" , "=" , string-lit
                 | "canonical" , "=" , ident ;
variant-type    = "variant" , "{" , variant-case* , "}" ;
variant-case    = upper-ident , payload-type? , ","? ;
payload-type    = "(" , type-ref , ")" ;

type-ref        = qual-ident , type-args?
                | "Option" , "<" , type-ref , ">"
                | "List" , "<" , type-ref , "," , "max" , "=" , bound-ref , ">"
                | "Map" , "<" , type-ref , "," , type-ref , "," ,
                  "max" , "=" , bound-ref , ">" ;
type-args       = "<" , type-ref , { "," , type-ref } , ">" ;

fn-decl         = "fn" , ident , "(" , param-list? , ")" ,
                  "->" , type-ref , pure-clause? , block ;
pure-clause     = "pure" ;

intent-decl     = "intent" , ident , "(" , param-list? , ")" ,
                  "returns" , type-ref ,
                  intent-clause* , block ;
intent-clause   = profile-clause
                | implements-clause
                | where-clause
                | footprint-clause
                | budget-clause ;
profile-clause  = "profile" , qual-ident ;
implements-clause = "implements" , qual-ident ;
where-clause    = "where" , predicate , { "," , predicate } ;
footprint-clause = "footprint" , "<=" , qual-ident ;
budget-clause   = "budget" , "<=" , qual-ident ;

param-list      = param , { "," , param } ;
param           = ident , ":" , type-ref ;

block           = "{" , statement* , "}" ;

statement       = let-stmt
                | assert-stmt
                | require-stmt
                | guarantee-stmt
                | semantic-record-stmt
                | if-stmt
                | for-stmt
                | effect-stmt
                | return-stmt ;

let-stmt        = "let" , ident , type-annotation? , "=" ,
                  let-rhs , effect-else-clause? , ";" ;
let-rhs         = expr | effect-branch-expr ;
type-annotation = ":" , type-ref ;
assert-stmt     = "assert" , predicate , ";" ;
require-stmt    = "require" , predicate , obstruction-clause? , ";" ;
guarantee-stmt  = "guarantee" , predicate , obstruction-clause? , ";" ;
obstruction-clause = "else" , qual-ident ;
semantic-record-stmt = "record" , qual-ident , record-lit ,
                       effect-else-clause? , ";" ;
if-stmt         = "if" , predicate , block , else-clause? ;
else-clause     = "else" , ( block | if-stmt ) ;
for-stmt        = "for" , ident , "in" , expr ,
                  "bounded" , bound-ref , block ;
effect-stmt     = call-expr , effect-else-clause? , ";" ;
effect-else-clause = "else" , qual-ident ;
effect-branch-expr = "if" , predicate , effect-yield-block ,
                     "else" , effect-yield-block ;
effect-yield-block = "{" , statement* , yield-stmt , "}" ;
yield-stmt      = "yield" , expr , ";" ;
return-stmt     = "return" , expr , ";" ;

predicate       = expr ;

expr            = if-expr ;
if-expr         = "if" , predicate , "then" , expr , "else" , expr
                | logic-or ;
logic-or        = logic-and , { "||" , logic-and } ;
logic-and       = equality , { "&&" , equality } ;
equality        = relation , { ( "==" | "!=" ) , relation } ;
relation        = additive , { ( "<" | "<=" | ">" | ">=" ) , additive } ;
additive        = multiplicative , { ( "+" | "-" ) , multiplicative } ;
multiplicative  = unary , { ( "*" | "/" | "%" ) , unary } ;
unary           = ( "!" | "-" ) , unary | postfix ;
postfix         = primary , { field-access | call-suffix | type-call-suffix } ;
field-access    = "." , ident ;
call-suffix     = "(" , arg-list? , ")" ;
type-call-suffix = "<" , type-ref , ">" , "(" , arg-list? , ")" ;
arg-list        = expr , { "," , expr } ;

primary         = ident
                | qual-ident
                | int-lit
                | bool-lit
                | string-lit
                | bytes-lit
                | record-lit
                | list-lit
                | "(" , expr , ")" ;
record-lit      = "{" , record-entry-list? , "}" ;
record-entry-list = record-entry , { "," , record-entry } , ","? ;
record-entry    = record-field | spread-field ;
record-field    = ident , ":" , expr ;
spread-field    = "..." , expr ;
list-lit        = "[" , expr-list? , "]" ;
expr-list       = expr , { "," , expr } , ","? ;

call-expr       = postfix ;
```

Semantic grammar rules:

- `migration` and `projection` are reserved words for future syntax and are not
  accepted as v1 declarations.
- Keywords are reserved as bare identifiers but may appear after `.` as member
  names, so `ref.ensure(value)` and `history.event.record(value)` are legal.
- Each intent may contain at most one `profile`, one `implements`, one
  `footprint`, and one `budget` clause.
- Multiple `where` clauses are permitted and merge conjunctively.
- `effect-else-clause` is legal only when the right-hand side expression or
  statement is an imported effect.
- `effect-branch-expr` is legal only in `let` binding position.
- `effect-yield-block` bodies must remain A-normal and all branches must yield
  the same type.
- `yield` is legal only as the final statement of an effect-yield block.
- `return` is not legal inside an effect-yield block.
- Record spreads evaluate left-to-right. Later explicit fields override earlier
  spread fields; duplicate explicit fields reject; the resulting field set must
  exactly match the expected record type.

## Core Types

Edict v1 defines a small deterministic type universe.

### Scalar Types

- `Bool`
- `I32`, `I64`
- `U32`, `U64`
- `String`
- `Bytes`
- `Digest`
- `Unit`

`Float` is not a core v1 type. A target or lawpack may define canonical
floating-point semantics, but the core language does not assume them.

Core `String` is an exact sequence of Unicode scalar values. No implicit
normalization is applied. Comparison and hashing operate on the exact scalar
sequence unless the type or field declares a canonicalization constraint such as
`canonical=nfc`. Raw editor or file-buffer content should use `Bytes` or a
lawpack-defined raw text scalar, not ambiently normalized `String`.

### Compound Types

- record types;
- enum types;
- variant types;
- `Option<T>`;
- `List<T, max=N>`;
- `Map<K, V, max=N>`;
- imported shape/lawpack/target types.

Maps must use canonical key ordering. Lists and maps must declare finite
maximum cardinality. Map key types in v1 are limited to scalar, enum, digest,
bytes, string with declared canonicalization policy, or imported types that
explicitly declare canonical map-key semantics. Target references, closures,
records, lists, maps, and variants are rejected as map keys in v1.

## Expressions

Edict expressions are pure unless the expression is an imported effect call
in A-normal effect position inside an intent body. Pure expressions may:

- construct records, variants, lists, and maps;
- read local variables and operation inputs;
- access fields;
- call pure functions;
- call deterministic standard functions;
- compare values;
- hash canonical values;
- branch with `if then else`.

Pure expressions may not:

- call target intrinsics or lawpack semantic effects;
- observe runtime state;
- allocate runtime handles;
- call host callbacks;
- use reflection;
- perform IO.

## Statements

Intent bodies are statement-oriented so effect ordering is explicit. The v1
statement set is deliberately small:

- `let` binds an immutable local.
- `assert` records a compile-verifiable or runtime-preflight-verifiable fact.
- `require` checks a precondition and maps failure to a typed obstruction.
- `guarantee` checks a postcondition and maps failure to a typed obstruction.
- `record` desugars to a portable semantic lawpack effect.
- `if` supports bounded branching.
- branch-yield `if` expressions support conditional effect values in `let`
  binding position.
- `for` supports finite bounded iteration.
- effect statements call target or lawpack intrinsics and may map effect
  failures with `else`.
- `return` emits the operation receipt/output value.

No assignment statement exists in v1. Locals are immutable. Accumulation must be
expressed through bounded folds supplied by deterministic standard functions or
through target/lawpack-provided profile functions with explicit semantics.

## Standard Functions

The Edict Core prelude is intentionally small:

- `hash(label: StringLiteral, value...) -> Digest`
- `canonicalEncode(value) -> Bytes`
- `len(value) -> U64`
- `some<T>(value: T) -> Option<T>`
- `none<T>() -> Option<T>`
- `default<T>(value: Option<T>, fallback: T) -> T`
- `isSome(value) -> Bool`
- `unwrap(value) -> T` only after proof that an option is present
- integer arithmetic with explicit overflow diagnostics
- string operations with declared canonicalization policy

Every prelude function must be total over valid input or must expose a typed
diagnostic that the compiler can force authors to handle.

`hash` is a source-level helper, not the artifact hash primitive. The label must
be a string literal so digest domains are stable and reviewable.

## Effects And Footprints

An effect is a typed, imported operation emitted by a target intrinsic or
lawpack semantic effect. Core IR represents effects abstractly:

```text
Effect {
  authority: TargetProfileRef | LawpackRef,
  intrinsic: CanonicalIntrinsicCoordinate,
  typeArgs: [CoreType],
  args: [CoreExpr],
  effectKind:
    read | create | ensure | replace | delete | append | reduce |
    semantic.emit | custom,
  pathCondition: CorePredicate,
  guards: [CoreGuard],
  guardStrength:
    localPrecheck | targetAtomicGuard | verifierProof,
  obstructionMap: ObstructionMap,
  cardinalityBound: CardinalityBound,
  footprintTemplate: FootprintTemplateRef,
  costTemplate: CostTemplateRef
}
```

The target profile or lawpack defines the footprint algebra and cost template.
Core IR records the authority, intrinsic coordinate, resolved argument
expressions, effect kind, path condition, atomic guards, obstruction mappings,
bounds, and authority-owned metadata.

Examples:

```edict
let basis = echo.ref<StructuralBasis>(input.basisId).read()
  else history.StructuralBasisMissing;
```

may infer an Echo graph read footprint:

```text
target: echo.dpo@1
reads:
  node StructuralBasis[input.basisId]
```

```edict
log.stream("history").append<HistoryEntryRecorded>(event);
```

may infer an EventLog append footprint:

```text
target: eventlog.append@1
writes:
  append stream history event HistoryEntryRecorded
```

```edict
let entry = history.entry.record(event);
```

may infer a lawpack semantic effect:

```text
authority: history.optics@1
effectKind: semantic.emit
coordinate: history.optics@1.entry.record
```

## Target Profiles

A runtime target profile must declare:

- profile identity, version, and digest;
- accepted Edict Core ABI versions;
- target intrinsic namespace;
- type signatures for every intrinsic;
- effect signatures for every intrinsic;
- footprint algebra;
- target IR schema;
- verifier ABI;
- obstruction taxonomy;
- bundle profile;
- generated artifact profiles;
- canonical encoding rules;
- conformance fixtures;
- lowerer plugin ABI and digest requirements;
- verifier plugin ABI and digest requirements;
- sandbox/runtime identity;
- deterministic execution constraints;
- fuel and cost model;
- third-party conformance fixture digest sets for compiler, lowerer, verifier,
  negative, canonical encoding, and obstruction behavior.

Target profile manifests should be data. Target lowerers and verifiers may be
locked executable components, but their digests, ABI, sandbox identity,
determinism constraints, fuel model, and conformance fixtures must be explicit.
The manifest states the contract; the lowerer and verifier code satisfy it.

Minimal manifest sketch:

```json
{
  "apiVersion": "edict.target-profile/v1",
  "id": "echo.dpo",
  "version": "1",
  "digest": "sha256:...",
  "acceptedCoreAbi": ["edict.core/v1"],
  "intrinsics": "echo.dpo.intrinsics/v1",
  "footprintAlgebra": "echo.dpo.footprint/v1",
  "targetIr": "echo.span-ir/v1",
  "verifier": "echo.dpo.verifier/v1",
  "lowererDigest": "sha256:...",
  "verifierDigest": "sha256:...",
  "sandbox": "edict.wasm-component/v1",
  "fuelModel": "edict.fuel/v1",
  "bundleProfile": "continuum.bundle.lawful-autonomous/v1",
  "assuranceLane": "continuum.lane.lawful-autonomous/v1",
  "display": {
    "codename": "YOLO",
    "expansion": "You Only Lawfully Operate"
  },
  "conformance": {
    "compilerFixtures": ["sha256:..."],
    "lowererFixtures": ["sha256:..."],
    "verifierFixtures": ["sha256:..."],
    "negativeFixtures": ["sha256:..."],
    "canonicalEncodingFixtures": ["sha256:..."],
    "obstructionFixtures": ["sha256:..."]
  }
}
```

## Profile Vocabulary

Source examples use compact profile names, but Core must split the concepts:

```text
operationMode:
  readOnly | createOnly | replace | append | custom

targetProfile:
  echo.dpo@1 | kv.transactional@1 | ...

lawProfile:
  history.optics@1.recordEntry | ...

bundleProfile:
  continuum.bundle.lawful-autonomous/v1 | ...

admissionClass:
  participant-owned policy label
```

A source clause such as:

```edict
profile echo.createOnly
```

is a claim that resolves into structured Core fields. It is not proof. The
compiler verifies the claim against inferred effects, target profile rules,
lawpack rules, footprint bounds, and cost bounds.

## Edict Core IR

Edict Core IR is the canonical compiler output before target lowering. It is
not source syntax and not target IR.

### Core Module Shape

```json
{
  "apiVersion": "edict.core/v1",
  "package": {
    "name": "graft.structural_history",
    "version": "1"
  },
  "source": {
    "profile": "edict@1",
    "hash": "sha256:..."
  },
  "imports": [],
  "types": [],
  "functions": [],
  "intents": [],
  "canonicalization": {
    "codec": "edict.canonical-cbor/v1",
    "hash": "sha256:..."
  }
}
```

### Core Intent Shape

```json
{
  "name": "recordGitWarpImportBatch",
  "coordinate": "graft.structural_history@1.intent.recordGitWarpImportBatch",
  "input": "RecordGitWarpImportBatchInput",
  "output": "RecordGitWarpImportBatchReceipt",
  "claims": {
    "operationMode": "createOnly",
    "targetProfile": "echo.dpo@1",
    "lawProfile": null,
    "bundleProfile": "continuum.bundle.lawful-autonomous/v1",
    "assuranceLane": "continuum.lane.lawful-autonomous/v1",
    "admissionClass": null
  },
  "implements": null,
  "preconditions": [],
  "postconditions": [],
  "budget": {
    "maxSteps": 10000,
    "maxAllocatedBytes": 1048576,
    "maxOutputBytes": 65536,
    "maxTargetReads": 128,
    "maxTargetWrites": 128,
    "maxClosureReads": 8,
    "maxGeneratedEffects": 256
  },
  "body": {
    "kind": "block",
    "nodes": []
  },
  "diagnosticPolicy": "edict.diagnostics/v1"
}
```

### Core Body Shape

Core is ANF/SSA-like. It preserves ordered lets, effect nodes, structured
blocks, branch predicates, loop bounds, obstruction edges, and return
construction.

```json
{
  "kind": "block",
  "nodes": [
    {
      "kind": "let",
      "id": "%0",
      "debugName": "insertBytes",
      "expr": {
        "call": "jedit.rope@1.encodeText",
        "args": ["%input.insertText"]
      }
    },
    {
      "kind": "if",
      "predicate": {
        "op": "!=",
        "left": { "call": "core.len", "args": ["%0"] },
        "right": { "u64": "0" }
      },
      "result": "%1",
      "debugName": "newBlob",
      "then": {
        "kind": "block",
        "nodes": [
          {
            "kind": "effect",
            "bind": "%2",
            "debugName": "blob",
            "authority": "echo.dpo@1",
            "intrinsic": "echo.dpo@1.ref.ensure",
            "effectKind": "ensure",
            "pathCondition": {
              "op": "!=",
              "left": { "call": "core.len", "args": ["%0"] },
              "right": { "u64": "0" }
            },
            "guards": [],
            "guardStrength": "targetAtomicGuard",
            "obstructionMap": {
              "mismatch": "jedit.rope@1.TextBlobHashConflict"
            },
            "cardinalityBound": { "max": 1 },
            "costTemplate": "echo.dpo@1.cost.ensure-node",
            "footprintTemplate": "echo.dpo@1.footprint.ensure-node"
          },
          {
            "kind": "yield",
            "expr": { "option": "some", "value": "%2" }
          }
        ]
      },
      "else": {
        "kind": "block",
        "nodes": [
          {
            "kind": "yield",
            "expr": { "option": "none", "type": "shape.TextBlob" }
          }
        ]
      }
    },
    {
      "kind": "for",
      "item": "%leaf",
      "collection": "%rewrite.newLeaves",
      "bound": "jedit.rope@1.maxCreatedLeaves",
      "body": {
        "kind": "block",
        "nodes": [
          {
            "kind": "effect",
            "authority": "echo.dpo@1",
            "intrinsic": "echo.dpo@1.ref.create",
            "effectKind": "create",
            "pathCondition": { "bool": true },
            "guards": [],
            "guardStrength": "targetAtomicGuard",
            "obstructionMap": {
              "conflict": "jedit.rope@1.RopeLeafAlreadyExists"
            },
            "cardinalityBound": {
              "max": "jedit.rope@1.maxCreatedLeaves"
            }
          }
        ]
      }
    }
  ]
}
```

Hash-significant Core predicates are typed expression trees, not strings.
`debugName` fields and source local names are illustrative/review metadata and
must either be excluded from the authoritative hash input or stored in a
non-hash diagnostic sidecar.

### Canonicalization Rules

Core IR canonicalization must:

- sort declarations by canonical coordinate where source order is not semantic;
- preserve statement order where effect order is semantic;
- encode typed integers by width and signedness;
- encode strings in the declared normalization form;
- encode bytes as bytes, not strings;
- encode maps by canonical key order;
- resolve aliases to canonical coordinates;
- alpha-normalize local binders and SSA ids;
- encode predicates as typed Core expression trees;
- remove comments and formatting;
- remove source locations from hash input;
- include source locations in sidecar diagnostic maps;
- include all imported lawpack/profile digests;
- include lowerer and verifier digests when producing a locked bundle;
- fail if any imported digest is unresolved.

The authoritative hash input is `edict.canonical-cbor/v1` unless a later spec
supersedes it. `edict.canonical-json/v1` is a review/debug rendering and must
not be used as the authority for full-width typed integers unless every scalar
is explicitly wrapped.

## Wesley Compilation To IR

Wesley should compile Edict through a source-profile boundary, not by adding
Continuum or Echo policy to `wesley-core`.

### Compiler Surfaces

Recommended bootstrap crate boundaries:

- `edict-syntax`: lexer, parser, concrete syntax tree, source maps.
- `edict-core`: AST, type model, Core IR, canonicalization, hash fixtures.
- `edict-compile`: type checking, determinism checking, effect extraction.
- `wesley-edict-profile`: Wesley integration that consumes Shape IR and Law IR
  and invokes Edict compiler components.
- target profile crates outside Wesley core, for example `echo-edict-target`.

If these crates temporarily live in the Wesley workspace, they should carry an
explicit extraction note and must not be imported by `wesley-core` in a way that
makes Edict, Continuum, or Echo part of generic GraphQL lowering.

### Edict Source Pipeline

```text
Edict source
  -> lex and parse
  -> build concrete syntax tree with source spans
  -> lower to typed Edict AST
  -> resolve imports by identity/version/digest
  -> resolve optional Wesley Shape IR and Law IR facts
  -> typecheck
  -> determinism check
  -> effect extraction
  -> footprint ceiling check when declared
  -> cost budget check
  -> lower to Core IR
  -> canonicalize Core IR through edict.canonical-value/v1
  -> compute Core IR hash
```

### GraphQL/Wesley Source Profile Pipeline

Wesley may also compile GraphQL and `weslaw` into Edict-compatible source
profile facts:

```text
GraphQL SDL
  -> Wesley Shape IR
  -> shape facts

weslaw/v1
  -> Wesley Law IR
  -> law facts

shape facts + law facts + source profile mapping
  -> Edict Core declarations or imports
```

This bridge is useful for migration and generated artifact continuity. It must
not make GraphQL the Continuum protocol or require every Edict source to start
as GraphQL.

`graphql-wesley@1` must also supply bounds before a locked lawful-autonomous
bundle can be produced. Any imported GraphQL field of type `String`, `Bytes`,
list, or nested input object must resolve to Edict bounds through Shape IR,
`weslaw` constraints, source-profile configuration, or participant policy.
Unbounded imported GraphQL text, bytes, lists, nested input graphs, or output
fields reject locked-bundle production.

### Target Lowering Pipeline

```text
Core IR + lawpacks + target profile
  -> target lowering
  -> target IR
  -> target verifier
  -> inferred target footprint templates
  -> inferred target cost templates
  -> generated artifacts
  -> contract bundle manifest
  -> SHA-lock
  -> HOLMES / Watson / Moriarty evidence
```

Wesley can orchestrate this pipeline when acting as a compiler front end, but
target meaning is profile-owned.

## Diagnostics

Diagnostics must be structured and stable enough for agents to repair source.

Diagnostic shape:

```json
{
  "code": "EDICT-EFFECT-UNDERCLAIM",
  "severity": "error",
  "message": "computed target footprint exceeds declared maximum",
  "sourceSpan": {
    "file": "graft.edict",
    "start": { "line": 12, "column": 3 },
    "end": { "line": 12, "column": 54 }
  },
  "coordinate": "graft.structural_history@1.intent.recordGitWarpImportBatch",
  "repair": {
    "kind": "adjust-footprint-bound-or-remove-effect",
    "details": {}
  }
}
```

Initial diagnostic families:

- `EDICT-PARSE-*`
- `EDICT-IMPORT-*`
- `EDICT-TYPE-*`
- `EDICT-DETERMINISM-*`
- `EDICT-BOUNDS-*`
- `EDICT-EFFECT-*`
- `EDICT-FOOTPRINT-*`
- `EDICT-LOWERING-*`
- `EDICT-CANONICAL-*`
- `EDICT-BUNDLE-*`

Target profiles may define target-specific diagnostics, but they must preserve
the compiler/registration/obstruction split.

## What Makes Edict Different

### Compared To GraphQL

GraphQL defines shape, query, mutation, and subscription surfaces. Edict
defines lawful operation implementations with compiler-visible effects.
GraphQL may be an Edict source profile input, but GraphQL does not provide
target footprint inference or target IR verification by itself.

### Compared To SQL And Stored Procedures

SQL assumes a relational storage model. Edict has no built-in storage model.
Runtime target profiles provide the state model and verifier semantics.

### Compared To Solidity And Smart Contract VMs

Solidity targets a global VM and chain execution model. Edict targets no
universal runtime. It compiles to participant-supported target IRs and binds
all evidence into SHA-locked bundles.

### Compared To Policy Languages

Policy languages such as Rego decide whether something should be allowed.
Edict defines the operation body, its typed effects, its footprint template,
and the artifacts needed to register and invoke it. Admission policy remains
separate.

### Compared To Workflow Languages

Workflow languages orchestrate external steps and often rely on opaque task
implementations. Edict rejects opaque raw callbacks in the lawful-autonomous
lane. Effects must be visible through imported intrinsics.

### Compared To IDLs And ABI Languages

IDLs define callable shape. Edict defines shape plus lawful effect semantics,
target lowering obligations, verifier evidence, and bundle hashes.

### Compared To Echo DPO

Echo DPO is a target semantics for typed graph rewrite. Edict Core is the
runtime-neutral language that can lower to Echo DPO or to non-graph targets.
Span IR is Echo target IR, not Edict Core IR.

## Implementation Plan

### Phase 0: Spec And Fixtures

- Land this Edict v1 language spec under packet `0021`.
- Define `edict.canonical-value/v1`.
- Define `edict.canonical-cbor/v1` as the authoritative hash input.
- Define `edict.canonical-json/v1` as review/debug rendering.
- Add parser conformance fixtures for valid and invalid syntax.
- Add parser fixtures for branch-yield conditional effects, effect `else`
  obstruction mapping, `budget <=`, bound refs, spread literals,
  order-independent intent clauses, and rejected `migration`/`projection`
  declarations.
- Add Core IR canonicalization fixtures with exact expected hashes.
- Add relapse fixtures proving no graph built-ins exist in Core.
- Add same-semantics/different-spelling fixtures:
  formatting changes, comment changes, import alias changes, nonsemantic
  declaration reordering, equivalent map literal ordering, and source-location
  changes.
- Add digest mismatch fixtures for lawpack, target profile, shape, lowerer, and
  verifier substitution.
- Add JSON integer ambiguity fixtures for `I64`, `U64`, and `Bytes`.
- Add relapse fuzz fixtures for ambient time/randomness, host callbacks,
  unbounded closures, duplicate content-addressed creates, target profile digest
  swaps, source-path changes, codename coordinates, and hidden writes in
  read-only operations.

### Phase 1: Parser And AST

- Implement lexer and parser for the grammar above.
- Emit concrete syntax tree and source spans.
- Add structured parse diagnostics.
- Preserve comments only in source maps, not semantic AST.

### Phase 2: Type System And Determinism

- Implement scalar, record, enum, variant, option, list, and map types.
- Resolve imports by canonical coordinate and digest.
- Reject recursion, unbounded loops, nondeterministic APIs, and unresolved
  profile semantics.
- Enforce GraphQL source-profile bounds for imported strings, bytes, lists,
  nested inputs, and outputs.
- Add agent-readable repair metadata to diagnostics.

### Phase 3: Edict Core IR

- Lower typed AST to Edict Core IR.
- Define canonical CBOR encoding plus canonical JSON review rendering.
- Compute stable Core IR hashes.
- Alpha-normalize local binders in hash-significant Core.
- Encode predicates as typed expression trees, not strings.
- Add golden fixtures proving formatting and alias changes do not alter Core
  IR hashes.

### Phase 4: Target Profile Manifest

- Define `edict.target-profile/v1`.
- Add `kv.transactional@1` as the first non-Echo target profile fixture.
- Add a target profile conformance harness.
- Prove a participant can advertise lawful-autonomous bundle admission
  without Echo DPO.
- Add KV/CAS fixtures for read key, missing key, compare version,
  create-if-absent, ensure-same, replace-if-version, delete-if-version, bounded
  range read, conflict obstruction, and cost bounds.

### Phase 5: Echo DPO Target

- Implement `echo.dpo@1` in the Echo-owned target lane.
- Lower a narrow runtime-native Edict fixture to Echo Span IR.
- Verify graph footprint inference and DPO side-condition diagnostics.
- Generate Echo-specific registration metadata outside Wesley core.

### Phase 6: Bundle And SHA-lock

- Define `continuum.contract-bundle/v1`.
- Bind source, Core IR, target IR, lawpack, target profile, verifier report,
  generated artifacts, participant policy epoch, and assurance reports.
- Add tamper tests for each hash-bound component.
- Add transparency-log envelope fields for bundle, profile, lawpack, and
  admission receipt digests.
- Emit an explanation artifact listing inferred effects, path predicates,
  bounds, budgets, obstruction mappings, runtime guards, and target lowering
  obligations.

### Phase 7: HOLMES, Watson, Moriarty Integration

- Make HOLMES assess exact Edict bundle evidence.
- Make Watson explain compiler, lowering, admission, and obstruction failures.
- Make Moriarty probe nondeterminism, footprint underclaiming, target profile
  substitution, and FIDLAR laundering.
- Make Moriarty mutate source and manifests for same-hash, changed-hash, and
  reject outcomes with no fourth result.

### Phase 8: Wesley Source Profile Bridge

- Add `graphql-wesley@1` profile facts from Shape IR.
- Add `weslaw@1` profile facts from Law IR.
- Prove GraphQL and weslaw can feed Edict Core without becoming required for
  all Edict sources.

### Phase 9: Extraction Decision

- If bootstrap work started in Wesley, extract language crates and fixtures to
  `flyingrobots/edict` before treating Edict as a public product surface.
- Leave Wesley with adapter crates and integration tests.
- Leave Echo with `echo.dpo@1`.
- Leave Continuum with participant protocol and admission flow.

### Phase 10: Profile Diff And Transparency Operations

- Implement `edict profile diff` classification for target profile upgrades.
- Classify hash compatibility, source compatibility, Core compatibility,
  Target IR compatibility, verifier compatibility, and admission impact.
- Publish or export transparency-log entries for bundle and admission evidence.

## Acceptance Criteria

- Edict Core has no graph built-ins.
- Source syntax can import `echo.dpo@1` and a non-Echo target profile.
- Formatting-only source changes do not alter Core IR hash.
- Import alias changes do not alter Core IR hash.
- Digest mismatch rejects compilation.
- Nondeterminism rejects compilation.
- Unbounded loops reject compilation.
- Recursive pure functions reject compilation.
- Declared footprint underclaim rejects compilation.
- FIDLAR raw callbacks are impossible in normal syntax.
- Target lowering produces profile-owned target IR.
- Echo Span IR is documented and tested as Echo target IR only.
- A toy non-Echo target proves the architecture is not graph-bound.
- Wesley GraphQL/weslaw bridge emits source-profile facts without making
  GraphQL required by Edict.
- Contract bundle SHA-lock detects source, Core IR, target IR, verifier, and
  generated artifact tampering.
- Read-only intent containing a write effect rejects.
- Read-only intent containing a runtime-materialized semantic append/log effect
  rejects.
- Query and observer operations are first-class lawful-autonomous operations with
  source hash, Core IR hash, target profile, footprint, budget, verifier result,
  generated artifacts, admission receipt, and obstruction taxonomy.
- Proof-only semantic facts are distinguished from durable runtime effects.
- Unbounded closure read rejects compilation or locked-bundle production.
- Conditional effects preserve path predicates in Core IR.
- Loop effects preserve static maximum cardinality in Core IR.
- Footprint and cost are checked separately.
- Content-addressed duplicate create fixture distinguishes `create` from
  `ensure`.
- Full-buffer text snapshot without maximum bound rejects.
- Shape import without digest may parse in development mode but cannot produce
  a locked bundle without lockfile resolution.
- Lawpack helper implemented outside Edict must be digest-locked, sandboxed,
  deterministic, fuel-bounded, and cost-bounded.
- Cross-bundle `invoke` is rejected in v1.
- Runtime stale-basis assumptions lower to target guards, not local assertions
  only.
- Codename terms reject from hash-significant canonical coordinates.
- Branch-yield conditional effect values lower to structured Core branches with
  result bindings and path predicates.
- Effect failures map to typed domain obstructions through checked
  `obstructionMap` entries.
- Source `budget <=` clauses lower to Core budgets and reject underclaimed cost.
- Loop, list, map, and field bounds accept literal or digest-locked bound refs.
- Intent clauses are order-independent with unique profile/implements/footprint
  and budget clauses.
- `migration` and `projection` are reserved and rejected by the v1 parser.
- `some`, `none`, and `default` are prelude functions with pinned semantics.
- Record spread literals are deterministic and reject ambiguous explicit fields.
- GraphQL source-profile imports without bounds reject locked-bundle production.
- Opaque handles are modeled as capability receipts with issuer bundle hash,
  scope, basis, capability kind, revocation/expiry policy, and participant policy
  epoch.
- Local binder spelling does not affect Core hash.
- Hash-significant Core predicates are typed expression trees, not strings.
- Map key types reject non-canonical key domains.
- Source-level `hash` requires a string-literal label and lowers to
  domain-separated canonical hashing.
- Compiler emits an explanation artifact listing inferred effects, path
  predicates, bounds, budget, obstruction mappings, runtime guards, and target
  lowering obligations.
- Compiler emits a bundle nutrition label for every compiled operation.
- Bundle evidence records materials, products, builder identity, parameters,
  participant descriptor digest, catalog snapshot digest, admission policy
  digest, and policy epoch.
- Bundle, lawpack, target profile, and admission receipt digests are ready for
  transparency-log publication.
- `edict profile diff` classifies compatibility and admission impact for target
  profile upgrades.
- Moriarty relapse fuzzing mutates source/manifests and classifies each outcome
  as same hash, changed hash, or reject.

## Resolved v1 Directions

- MVP user-defined pure functions are first-order, non-recursive,
  non-higher-order, monomorphized or non-generic, effect-free, and cost-bounded.
- Authoritative hash input is `edict.canonical-cbor/v1`; canonical JSON is
  review/debug rendering.
- First non-Echo target is `kv.transactional@1`; event-log follows later.
- Migrations start as ordinary intents with a migration profile.
- Target profile manifests are data; lowerers and verifiers are locked,
  sandboxed executable components satisfying the manifest.
- Portable semantic records may exist only as sugar for lawpack semantic
  effects.
- Conditional effect values use branch-yield syntax in `let` binding position.
- Effect failure obstruction mapping is part of v1 source and Core.
- Cross-bundle `invoke` is rejected in v1.
- Query/observer operations are first-class and must prove read-only from
  inferred effects.

## Future Work

- A future version may allow cross-bundle `invoke` only when callee effects,
  costs, obstructions, target requirements, and admission requirements are
  inlined or summarized by verifier-approved bundle evidence.
- A future version may add first-class `migration`, `projection`, and `observer`
  declarations after ordinary intents and observer desugaring prove the
  semantics.
- A future version may loosen map-key restrictions for imported types with
  explicitly declared canonical key semantics.

## Relapse Checks

- Do not put Echo graph operations in Edict Core.
- Do not let Wesley core own Continuum participant policy.
- Do not let Continuum admission policy define language semantics.
- Do not describe Span IR as universal Edict or Continuum IR.
- Do not trust declared footprints without inferred effects.
- Do not let privileged host callbacks pass as lawful-autonomous
  operations.
- Do not require GraphQL for native Edict authoring.
- Do not make HOLMES, Watson, or Moriarty runtime authorities.

## Appendix A: jedit Intent Stress Test

### Source Anchors

The current jedit checkout inspected for this appendix is:

```text
/Users/james/git/jim/jedit
```

The installed app package surface is:

```text
contracts/jedit/rope.graphql
```

It exposes five operation boundaries:

- mutation `createBufferWorldline`;
- mutation `replaceRangeAsTick`;
- mutation `createCheckpoint`;
- query `worldlineSnapshot`;
- query `textWindow`.

Two adjacent jedit contract surfaces also exist:

- `contracts/jedit/text-buffer-optic.graphql`, an app-facing product optic
  contract with opaque read-basis handles;
- `contracts/jedit/structural-history.graphql`, an app-owned structural
  history contract marked as a surface Wesley should consume later.

This appendix treats `rope.graphql` as the normative current stress fixture
because it is the installed generated jedit package. The other two surfaces are
included as secondary stress sketches because they expose useful Edict language
pressure: capability invocation/composition, opaque handles, and semantic
history events.

### Stress Findings

The jedit translation supports the core proposal but exposes several v1
language requirements and negative fixtures:

- Read-only is an inferred theorem. Source may claim read-only posture, but
  target and lawpack effects must prove it.
- Target profiles need closure intrinsics. jedit's rope operation reads
  `ropeRangeClosure` and `anchorsIntersectingEditWindow`; those must be
  target/lawpack-defined closure reads, not generic Core concepts.
- Closure reads must carry cost and size bounds. `textWindow` is a positive
  fixture; unbounded full snapshot materialization is a negative fixture.
- Optional creates need first-class representation. `createBufferWorldline`
  optionally creates `Checkpoint`, `TextBlob`, and `RopeLeaf`.
- Content-addressed values need explicit `ensure` semantics. `TextBlob` ids
  derived from bytes should not use absence-only `create`.
- Current jedit SDL still uses `String` for `initialText` and `insertText`.
  The Edict design's determinism posture still recommends future raw editor
  text migrate to `Bytes` or a lawpack-defined raw text scalar so Unicode
  normalization cannot corrupt buffer content.
- Product-facing optic APIs need opaque capability handles. `ReadBasisHandle`
  belongs above the rope target and should be modeled as participant/app
  capability, not as Echo graph identity.
- Product-facing Edicts may need declared lowering from one capability to
  another. `createBuffer` naturally lowers to `createBufferWorldline` plus
  read-basis issuance. Cross-bundle `invoke` is rejected in v1.
- Query operations are not second-class. `worldlineSnapshot` and `textWindow`
  need the same SHA-lock, profile, target, and assurance posture as mutations.

### Installed Rope Package As Edict

The following source is intentionally written as a near-v1 stress sketch, not as
a committed parser fixture. It uses branch-yield conditional effects,
effect-level obstruction mapping, explicit budgets, and target symbolic refs.
`worldlineSnapshot` remains a negative v1 fixture until finite bounds exist. The
sketch uses `jedit.rope@1` helper functions and `echo.dpo@1` target intrinsics
to keep Echo graph semantics behind the target profile.

```edict
package jedit.rope_contract@1;

use shape "contracts/jedit/rope.graphql" as shape;
use lawpack jedit.rope@1 as rope;
use target echo.dpo@1 as echo;

intent createBufferWorldline(input: shape.CreateBufferWorldlineInput)
  returns shape.CreateBufferWorldlineResult
  profile echo.createOnly
  footprint <= rope.createBufferWorldlineMax
  budget <= rope.createBufferWorldlineBudget
  where input.bufferKey != ""
{
  let initialText = default(input.initialText, "");
  let projectionPath = default(input.projectionPath, input.bufferKey);
  let worldlineId = rope.worldlineId(projectionPath);

  let initialBytes = rope.encodeText(initialText);
  let initialBlob = if len(initialBytes) == 0 {
    yield none<shape.TextBlob>();
  } else {
    let blobRef = echo.ref<shape.TextBlob>(rope.textBlobId(initialBytes));
    let blob = blobRef.ensure({
      blobId: rope.textBlobId(initialBytes),
      encoding: shape.TextEncoding.UTF8,
      byteLength: len(initialBytes),
      contentHash: hash("TextBlob", initialBytes),
    }) else rope.TextBlobHashConflict;
    yield some(blob);
  };

  let initialLeaf = if isSome(initialBlob) {
    let leafRef = echo.ref<shape.RopeLeaf>(rope.initialLeafId(worldlineId));
    let leaf = leafRef.create({
      leafId: rope.initialLeafId(worldlineId),
      blobId: unwrap(initialBlob).blobId,
      startByte: 0,
      endByte: len(initialBytes),
      byteLength: len(initialBytes),
      lineCount: rope.lineCount(initialBytes),
      utf16Length: rope.utf16Length(initialText),
    }) else rope.RopeLeafAlreadyExists;
    yield some(leaf);
  } else {
    yield none<shape.RopeLeaf>();
  };

  let root = rope.initialRoot(worldlineId, initialLeaf);
  let headRef = echo.ref<shape.RopeHead>(rope.headId(root));
  let head = headRef.create({
    headId: rope.headId(root),
    worldlineId,
    rootNodeId: rope.rootNodeId(root),
    byteLength: len(initialBytes),
    lineCount: rope.lineCount(initialBytes),
    utf16Length: rope.utf16Length(initialText),
    equivalenceDigest: hash("RopeHead", initialBytes),
  }) else rope.RopeHeadAlreadyExists;

  let worldlineRef = echo.ref<shape.BufferWorldline>(worldlineId);
  let worldline = worldlineRef.create({
    worldlineId,
    bufferKey: input.bufferKey,
    canonicalHeadId: head.headId,
    createdAtRopeRewriteId: none<shape.ID>(),
    projectionPath,
  }) else rope.BufferWorldlineAlreadyExists;

  let checkpoint = if input.createInitialCheckpoint {
    let checkpointRef = echo.ref<shape.Checkpoint>(
      rope.checkpointId(worldlineId, head.headId)
    );
    let createdCheckpoint = checkpointRef.create({
      checkpointId: rope.checkpointId(worldlineId, head.headId),
      worldlineId,
      headId: head.headId,
      kind: shape.CheckpointKind.INITIAL,
      label: none<String>(),
      createdByRopeRewriteId: none<shape.ID>(),
    }) else rope.CheckpointAlreadyExists;
    yield some(createdCheckpoint);
  } else {
    yield none<shape.Checkpoint>();
  };

  return {
    worldline,
    head,
    checkpoint,
  };
}

intent replaceRangeAsTick(input: shape.ReplaceRangeAsTickInput)
  returns shape.ReplaceRangeAsTickResult
  profile echo.boundaryReplacementLens
  footprint <= rope.replaceRangeAsTickMax
  budget <= rope.replaceRangeAsTickBudget
  where input.startByte <= input.endByte
{
  let worldlineRef = echo.ref<shape.BufferWorldline>(input.worldlineId);
  let worldline = worldlineRef.read()
    else rope.WorldlineMissing;

  let baseHeadRef = echo.ref<shape.RopeHead>(input.baseHeadId);
  let baseHead = baseHeadRef.read()
    else rope.BaseHeadMissing;

  require worldline.canonicalHeadId == baseHead.headId
    else rope.StaleBaseHead;

  require baseHead.worldlineId == worldline.worldlineId
    else rope.BaseHeadWorldlineMismatch;

  let touchedRope = rope.rangeClosure(
    baseHead,
    input.startByte,
    input.endByte
  ).read() else rope.RopeRangeClosureExceeded;

  let affectedAnchors = rope.anchorsIntersectingEditWindow(
    worldline,
    baseHead,
    input.startByte,
    input.endByte
  ).read() else rope.AnchorClosureExceeded;

  let insertBytes = rope.encodeText(input.insertText);
  let rewrite = rope.replaceRangePlan(
    worldline,
    baseHead,
    touchedRope,
    affectedAnchors,
    input.startByte,
    input.endByte,
    insertBytes
  );

  let newBlob = if len(insertBytes) == 0 {
    yield none<shape.TextBlob>();
  } else {
    let blobRef = echo.ref<shape.TextBlob>(rewrite.newBlobId);
    let blob = blobRef.ensure({
      blobId: rewrite.newBlobId,
      encoding: shape.TextEncoding.UTF8,
      byteLength: len(insertBytes),
      contentHash: hash("TextBlob", insertBytes),
    }) else rope.TextBlobHashConflict;
    yield some(blob);
  };

  for leaf in rewrite.newLeaves bounded rope.maxCreatedLeaves {
    echo.ref<shape.RopeLeaf>(leaf.leafId).create(leaf)
      else rope.RopeLeafAlreadyExists;
  }

  for branch in rewrite.newBranches bounded rope.maxCreatedBranches {
    echo.ref<shape.RopeBranch>(branch.branchId).create(branch)
      else rope.RopeBranchAlreadyExists;
  }

  let nextHead = echo.ref<shape.RopeHead>(rewrite.nextHead.headId).create(
    rewrite.nextHead
  ) else rope.RopeHeadAlreadyExists;

  let ropeRewrite = echo.ref<shape.RopeRewrite>(rewrite.ropeRewriteId).create({
    ropeRewriteId: rewrite.ropeRewriteId,
    worldlineId: worldline.worldlineId,
    kind: shape.RewriteKind.REPLACE_RANGE_AS_TICK,
    sequenceNumber: rewrite.sequenceNumber,
    author: input.author,
  }) else rope.RopeRewriteAlreadyExists;

  let ropeDiff = echo.ref<shape.RopeDiff>(rewrite.ropeDiffId).create({
    ropeDiffId: rewrite.ropeDiffId,
    ropeRewriteId: ropeRewrite.ropeRewriteId,
    baseHeadId: baseHead.headId,
    nextHeadId: nextHead.headId,
    rewriteKind: shape.RewriteKind.REPLACE_RANGE_AS_TICK,
    startByte: input.startByte,
    endByte: input.endByte,
    insertedByteLength: len(insertBytes),
    deletedByteLength: input.endByte - input.startByte,
    inverseFragmentDigest: rewrite.inverseFragmentDigest,
    summary: rewrite.summary,
  }) else rope.RopeDiffAlreadyExists;

  let nextWorldline = {
    ...worldline,
    canonicalHeadId: nextHead.headId,
  };

  worldlineRef.replace(nextWorldline)
    else rope.StaleBaseHead;

  return {
    worldline: nextWorldline,
    nextHead,
    ropeRewrite,
    ropeDiff,
  };
}

intent createCheckpoint(input: shape.CreateCheckpointInput)
  returns shape.CreateCheckpointResult
  profile echo.createOnly
  footprint <= rope.createCheckpointMax
  budget <= rope.createCheckpointBudget
{
  let worldlineRef = echo.ref<shape.BufferWorldline>(input.worldlineId);
  let worldline = worldlineRef.read()
    else rope.WorldlineMissing;

  let currentHeadRef = echo.ref<shape.RopeHead>(worldline.canonicalHeadId);
  let currentHead = currentHeadRef.read()
    else rope.CurrentHeadMissing;

  require worldline.canonicalHeadId == currentHead.headId
    else rope.StaleBaseHead;

  let checkpoint = echo.ref<shape.Checkpoint>(
    rope.checkpointId(worldline.worldlineId, currentHead.headId)
  ).create({
    checkpointId: rope.checkpointId(worldline.worldlineId, currentHead.headId),
    worldlineId: worldline.worldlineId,
    headId: currentHead.headId,
    kind: input.kind,
    label: input.label,
    createdByRopeRewriteId: none<shape.ID>(),
  }) else rope.CheckpointAlreadyExists;

  return {
    worldline,
    head: currentHead,
    checkpoint,
  };
}

intent worldlineSnapshot(input: shape.WorldlineSnapshotInput)
  returns shape.WorldlineSnapshot
  profile echo.readOnly
  footprint <= rope.worldlineSnapshotMax
  budget <= rope.worldlineSnapshotBudget
{
  // Negative v1 fixture unless the lawpack or input supplies a finite
  // maxBytes/maxNodes bound for fullRopeClosure and materialized output.
  let worldline = echo.ref<shape.BufferWorldline>(input.worldlineId).read()
    else rope.WorldlineMissing;
  let head = echo.ref<shape.RopeHead>(worldline.canonicalHeadId).read()
    else rope.CurrentHeadMissing;
  let ropeNodes = rope.fullRopeClosure(head).read()
    else rope.UnboundedSnapshotRejected;
  let checkpoints = rope.checkpointsForWorldline(worldline).read()
    else rope.CheckpointReadExceeded;

  return {
    worldline,
    head,
    checkpoints,
    text: rope.materializeText(ropeNodes),
  };
}

intent textWindow(input: shape.TextWindowInput)
  returns shape.TextWindowReading
  profile echo.readOnly
  footprint <= rope.textWindowMax
  budget <= rope.textWindowBudget
  where input.viewportLineCount >= 0,
        input.beforeLines >= 0,
        input.afterLines >= 0,
        input.maxBytes >= 0,
        input.viewportLineCount <= rope.maxViewportLineCount,
        input.beforeLines <= rope.maxContextLines,
        input.afterLines <= rope.maxContextLines,
        input.maxBytes <= rope.maxTextWindowBytes
{
  let worldline = echo.ref<shape.BufferWorldline>(input.worldlineId).read()
    else rope.WorldlineMissing;
  let head = echo.ref<shape.RopeHead>(worldline.canonicalHeadId).read()
    else rope.CurrentHeadMissing;
  let window = rope.textWindowPlan(
    head,
    input.cursorLine,
    input.viewportLineCount,
    input.beforeLines,
    input.afterLines,
    input.maxBytes
  );
  let ropeNodes = rope.windowClosure(head, window).read()
    else rope.TextWindowBoundExceeded;

  return rope.materializeTextWindow(worldline, head, window, ropeNodes);
}
```

Checkpoint creation also needs an ID semantics decision. If
`rope.checkpointId(worldlineId, headId)` permits one checkpoint per head, then
`create` is correct and repeated calls obstruct. If the checkpoint is
content-addressed or idempotent, it should use `ensure`. If label or kind
distinguish checkpoints, the ID needs those fields or another entropy source.
The `StaleBaseHead` requirement in the sketch must lower to an atomic runtime
guard on the checkpoint creation or on the operation as a whole.

### Product Text Buffer Optic Sketch

The product-facing optic surface is not just a target operation. It creates and
uses opaque `ReadBasisHandle` capabilities over the installed rope package.
This stresses whether Edict v1 needs cross-capability invocation syntax, or
whether such composition should be expressed as a lawpack lowering.

The following `invoke` sketch is intentionally rejected for v1. The preferred
v1 route is a lawpack lowering from the product optic to target IR. A future
version may admit invocation only with verifier-approved callee summaries or
inlined effects, costs, obstructions, target requirements, and admission
requirements.

```edict
package jedit.text_buffer_optic@1;

use shape "contracts/jedit/text-buffer-optic.graphql" as optic;
use lawpack jedit.text_buffer_optic@1 as textBuffer;
use capability jedit.rope_contract@1 as rope;

intent createBuffer(input: optic.CreateBufferInput)
  returns optic.CreateBufferPayload
  profile textBuffer.productCreate
{
  let created = invoke rope.createBufferWorldline({
    bufferKey: input.bufferKey,
    initialText: input.initialText,
    projectionPath: input.projectionPath,
    createInitialCheckpoint: false,
  });

  let readBasis = textBuffer.issueReadBasis(created.worldline.worldlineId);

  return {
    buffer: textBuffer.toTextBuffer(created.worldline),
    readBasis,
    bufferVersion: 1,
    receiptId: textBuffer.receiptId(created),
  };
}

intent replaceRange(input: optic.ReplaceRangeInput)
  returns optic.ReplaceRangePayload
  profile textBuffer.productEdit
{
  let basis = textBuffer.resolveBuffer(input.bufferId);

  let edited = invoke rope.replaceRangeAsTick({
    worldlineId: basis.worldlineId,
    baseHeadId: basis.headId,
    startByte: input.startByte,
    endByte: input.endByte,
    insertText: input.insertText,
    author: none<String>(),
  });

  let readBasis = textBuffer.issueReadBasis(edited.worldline.worldlineId);

  return {
    buffer: textBuffer.toTextBuffer(edited.worldline),
    readBasis,
    bufferVersion: textBuffer.nextBufferVersion(input.bufferId),
    receiptId: textBuffer.receiptId(edited),
  };
}

intent textWindow(
  readBasis: optic.ReadBasisHandle,
  input: optic.TextWindowInput
)
  returns optic.TextWindowReading
  profile textBuffer.productRead
{
  let basis = textBuffer.resolveReadBasis(readBasis);

  let reading = invoke rope.textWindow({
    worldlineId: basis.worldlineId,
    cursorLine: input.cursorLine,
    viewportLineCount: input.viewportLineCount,
    beforeLines: input.beforeLines,
    afterLines: input.afterLines,
    maxBytes: input.maxBytes,
  });

  return textBuffer.toProductTextWindow(reading);
}
```

The `use capability` and `invoke` forms above are not accepted v1 grammar. They
are included to make the design pressure visible. The v1 alternative is a
lawpack lowering that rewrites the product optic directly to the same target IR
as the rope package without an explicit capability call in source.

### Structural History Sketch

The structural-history contract is semantic and storage-neutral in shape. It is
a good fit for portable Edict because it can be expressed first as history facts
and then lowered to Echo, git-warp, KV, or event-log targets through lawpacks.

```edict
package jedit.structural_history@1;

use shape "contracts/jedit/structural-history.graphql" as historyShape;
use lawpack jedit.structural_history@1 as history;

intent createTextHistory(input: historyShape.CreateTextHistoryInput)
  returns historyShape.CreateTextHistoryPayload
  implements history.createTextHistory
  budget <= history.createTextHistoryBudget
{
  let _created = history.textHistoryCreated.record({
    historyId: history.historyId(input.bufferKey, input.provenance),
    bufferKey: input.bufferKey,
    projectionPath: input.projectionPath,
    initialTextDigest: hash("TextHistory.initialText", input.initialText),
    provenance: input.provenance,
  }) else history.TextHistoryAlreadyExists;

  return history.createdPayload(input);
}

intent replaceTextRange(input: historyShape.ReplaceTextRangeInput)
  returns historyShape.ReplaceTextRangePayload
  implements history.replaceTextRange
  budget <= history.replaceTextRangeBudget
  where input.startByte <= input.endByte
{
  let _replaced = history.textRangeReplaced.record({
    historyId: input.historyId,
    baseRevisionId: input.baseRevisionId,
    range: {
      startByte: input.startByte,
      endByte: input.endByte,
    },
    insertedTextDigest: hash("TextHistory.insertText", input.insertText),
    author: input.author,
    provenance: input.provenance,
  }) else history.StaleTextRevision;

  return history.replacePayload(input);
}

intent openTextEditGroup(input: historyShape.OpenTextEditGroupInput)
  returns historyShape.TextEditGroupPayload
  implements history.openTextEditGroup
  budget <= history.openTextEditGroupBudget
{
  let _opened = history.textEditGroupOpened.record({
    historyId: input.historyId,
    provenance: input.provenance,
  }) else history.TextEditGroupAlreadyOpen;

  return history.openGroupPayload(input);
}

intent includeTextEventInOpenGroup(
  input: historyShape.IncludeTextEventInOpenGroupInput
)
  returns historyShape.TextEditGroupPayload
  implements history.includeTextEventInOpenGroup
  budget <= history.includeTextEventInOpenGroupBudget
{
  let _included = history.textEventIncludedInOpenGroup.record({
    historyId: input.historyId,
    eventId: input.eventId,
    provenance: input.provenance,
  }) else history.TextEditGroupMissing;

  return history.includeEventPayload(input);
}

intent closeTextEditGroup(input: historyShape.CloseTextEditGroupInput)
  returns historyShape.TextEditGroupPayload
  implements history.closeTextEditGroup
  budget <= history.closeTextEditGroupBudget
{
  let _closed = history.textEditGroupClosed.record({
    historyId: input.historyId,
    provenance: input.provenance,
  }) else history.TextEditGroupMissing;

  return history.closeGroupPayload(input);
}

intent createTextCheckpoint(input: historyShape.CreateTextCheckpointInput)
  returns historyShape.CreateTextCheckpointPayload
  implements history.createTextCheckpoint
  budget <= history.createTextCheckpointBudget
{
  let _checkpoint = history.textCheckpointCreated.record({
    historyId: input.historyId,
    revisionId: input.revisionId,
    kind: input.kind,
    projectionPath: input.projectionPath,
    provenance: input.provenance,
  }) else history.TextCheckpointAlreadyExists;

  return history.checkpointPayload(input);
}

intent textHistorySnapshot(input: historyShape.TextHistorySnapshotInput)
  returns historyShape.TextHistorySnapshotReading
  implements history.textHistorySnapshot
  profile history.readOnly
  budget <= history.textHistorySnapshotBudget
{
  let proof = history.textHistorySnapshotRequested.proof({
    historyId: input.historyId,
    cursorLine: input.cursorLine,
    viewportLineCount: input.viewportLineCount,
    beforeLines: input.beforeLines,
    afterLines: input.afterLines,
    maxBytes: input.maxBytes,
    includeEvents: input.includeEvents,
    includeEditGroups: input.includeEditGroups,
    includeCheckpoints: input.includeCheckpoints,
  });

  return history.snapshotReading(input, proof);
}
```

The structural-history sketch is the strongest argument for keeping Edict in a
dedicated language repository. It is not Echo-shaped, but it should still lower
to Echo when an Echo target lawpack exists. It may also lower naturally to an
event-log target without graph semantics.
