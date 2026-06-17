---
title: 'PLATFORM - Continuum YOLO, Runtime-Neutral Edict, and SHA-lock Assurance'
legend: 'PLATFORM'
lane: 'design'
packet: '0021-continuum-yolo-runtime-neutral-edict-sha-lock-assurance'
issue: 'https://github.com/flyingrobots/wesley/issues/611'
pr: 'https://github.com/flyingrobots/wesley/pull/610'
status: 'draft'
owners:
  - '@flyingrobots'
created: '2026-06-17'
updated: '2026-06-17'
---

<!-- SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

<!-- markdownlint-disable MD025 -->

# PLATFORM - Continuum YOLO, Runtime-Neutral Edict, and SHA-lock Assurance

<!-- markdownlint-enable MD025 -->

## Linked Issue

- [Implement runtime-neutral Continuum YOLO target profiles](https://github.com/flyingrobots/wesley/issues/611)

## Decision Summary

Continuum does **not** define a global graph, database, event log, repository, or official storage runtime. Continuum defines a lawful self-extension protocol: participants advertise accepted lawpacks, source profiles, runtime target profiles, bundle profiles, admission rules, and capability catalogs. Agents and applications compile candidate operations against those declared profiles and submit SHA-locked bundles to the participant runtime that actually owns execution.

This design keeps the YOLO north star:

```text
YOLO = You Only Lawfully Operate
```

and rejects the FIDLAR anti-pattern:

```text
FIDLAR = Footprints Ignored; Developer Lies About Risk
```

The major correction in this revision is:

```text
Edict Core is not a graph scripting language.
Edict Core is a deterministic lawful-effect language.
Storage primitives come from imported runtime target profiles.
```

For Echo, an Edict operation may lower to Echo DPO / Span IR with graph footprints. For git-warp, an Edict operation may lower to commit/ref/CRDT plans with ref/path/reducer footprints. For a KV runtime, it may lower to transactions and compare-and-swap effects. For an event-log runtime, it may lower to append/reducer plans. Continuum standardizes the lawful operation envelope, discovery, SHA-lock posture, and assurance workflow, not one universal storage model.

The governing rule remains:

```text
Unlawful effects do not compile.
Tampered artifacts do not register.
Valid operations that cannot apply to the current runtime state obstruct at runtime.
```

## Sponsored Human

A platform/runtime/application author wants agents and developers to create lawful capabilities without handing them raw runtime mutation callbacks. The author wants a compiler that infers the real effects, checks the target runtime's law profile, emits generated registration/client artifacts, and locks all evidence to exact hashes.

The author also wants to avoid accidentally making Echo's graph model into Continuum doctrine. Echo DPO is one runtime target profile, not the Continuum storage model.

## Sponsored Agent

An agent wants to interact with a Continuum participant. It must be able to ask:

- what source profiles can I author in?
- what lawpacks define the domain semantics?
- what runtime target profiles does this participant accept?
- what footprint algebra will my operation compile into?
- what verifier/law profile will judge my bundle?
- what existing capabilities can I invoke without compiling new law?
- what new capability bundle may I submit for admission?

The agent should repair typed compiler and assurance errors, not debug hidden runtime sandboxes or FIDLAR-shaped callbacks.

## Hill

By the end of this campaign, a Continuum participant can advertise accepted source profiles, lawpacks, runtime target profiles, bundle profiles, and admission policies. An agent or app can:

1. discover the participant's accepted profiles and lawpacks;
2. decide whether to invoke an existing capability or author a new one;
3. write an Edict operation or compatible source contract;
4. compile it into Edict Core IR and then into a target-specific operation IR;
5. receive compiler errors for unlawful effects, nondeterminism, invalid target rewrites, alias hazards, footprint lies, schema incompatibility, or unsupported profiles;
6. generate target-specific Rust/TypeScript/client/registration artifacts;
7. SHA-lock all source, IR, lawpack, compiler, target, verifier, generated artifact, and assurance evidence;
8. run HOLMES assurance on the exact SHA-locked bundle;
9. use Watson to explain findings and suggest repairs;
10. use Moriarty to adversarially probe the candidate bundle;
11. submit the verified bundle to the participant runtime;
12. receive an admission receipt or obstruction;
13. invoke the registered typed capability without receiving raw runtime authority.

## Core Vocabulary

| Term                   | Meaning                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuum              | Runtime-neutral lawful self-extension and participant protocol. Does not define an official storage runtime.                                                                              |
| YOLO                   | Lawful self-extension mode: You Only Lawfully Operate.                                                                                                                                    |
| FIDLAR                 | Anti-pattern: Footprints Ignored; Developer Lies About Risk.                                                                                                                              |
| Edict                  | Restricted deterministic source language for lawful operations.                                                                                                                           |
| Edict Core             | Runtime-neutral typed/effectful core language and canonical IR. Contains no graph-native built-ins.                                                                                       |
| Source Profile         | An accepted authoring syntax/profile, for example `edict@1`, `graphql-wesley@1`, or future LawSDL.                                                                                        |
| Lawpack                | Public versioned compiler/verifier semantics package. Defines domain law, directives or syntax extensions, target lowerings, law profiles, and conformance fixtures.                      |
| Runtime Target Profile | A participant-supported storage/execution profile, for example `echo.dpo@1`, `gitwarp.ref_crdt@1`, `kv.transactional@1`, or `eventlog.append@1`.                                          |
| Target Intrinsics      | Storage operations imported from a runtime target profile, such as Echo graph DPO primitives or git-warp ref/commit primitives.                                                           |
| Target IR              | Runtime-specific compiled operation IR. Echo's DPO target IR is Span IR. Other runtimes define their own IRs.                                                                             |
| Span IR                | Echo DPO target IR representing typed `L <- K -> R` graph rewrite rules, graph footprint templates, and DPO side conditions. Not universal Continuum IR.                                  |
| Footprint Algebra      | Runtime-target-specific effect model: graph reads/writes for Echo, ref/path writes for git-warp, key/range reads for KV, stream appends for event logs, etc.                              |
| Contract Bundle        | SHA-locked compiled registration artifact containing source hashes, Edict Core IR, target IR, manifests, generated artifacts, footprints, certificates, verifier reports, and provenance. |
| SHA-lock               | Canonical content-addressed lock tying source, IR, lawpacks, runtime profiles, compilers, generated artifacts, assurance reports, and signatures to exact hashes.                         |
| HOLMES                 | Assurance engine over exact SHA-locked bundles and generated evidence.                                                                                                                    |
| Watson                 | Explainer/remediator for compiler, verifier, HOLMES, and Moriarty findings.                                                                                                               |
| Moriarty               | Adversarial reviewer that tries to falsify lawfulness, determinism, footprint honesty, schema compatibility, and supply-chain integrity.                                                  |

## Non-Negotiable Principle

```text
Continuum has no graph.
Continuum has lawful operation bundles.

Edict Core has no graph.
Edict Core has deterministic effects and target imports.

Echo has a graph.
Echo lowers Edict to DPO / Span IR.

Other runtimes have other state models.
They lower Edict to their own lawful target IRs.
```

Short form:

```text
No universal store. Universal law shape.
```

## Problem

The old trusted-callback architecture is FIDLAR-shaped:

1. an app declares a footprint;
2. generated metadata records the declared footprint;
3. runtime code invokes a host callback;
4. the callback may receive raw graph/runtime authority;
5. the callback can read, write, create, delete, call nondeterministic APIs, or otherwise exceed the declared footprint;
6. generated artifact hashes prove the callback was wired in, not that the callback is lawful.

This is unacceptable for agent-authored capabilities. It is also unacceptable for deterministic causal systems.

The first revision of this design correctly rejected FIDLAR, but it overfit the replacement path to Echo DPO. That would accidentally make graph primitives part of Edict Core and make Span IR look like universal Continuum IR. That is wrong. Echo DPO is one runtime target profile.

The corrected problem statement:

- normal YOLO-path operations must not receive raw runtime callbacks;
- Edict Core must be runtime-neutral;
- every target profile must define its own storage intrinsics, footprint algebra, target IR, verifier, and bundle profile;
- Continuum participants must advertise what they accept;
- agents must compile against declared target profiles, not assume a global graph.

## Goals

This campaign includes:

- defining Edict Core as a deterministic, runtime-neutral lawful-effect language;
- keeping graph operations out of Edict Core;
- importing storage operations only through target profiles/lawpacks;
- supporting runtime-native Edict, where authors target a concrete profile such as `echo.dpo@1`;
- supporting portable semantic Edict, where authors target abstract lawpacks that may lower to multiple runtime profiles;
- inferring effects and footprints in the selected target's footprint algebra;
- lowering to target-specific IR: Echo Span IR, git-warp Commit/CRDT IR, KV transaction IR, event-log append/reducer IR, or future profiles;
- rejecting invalid target operations at compile time;
- preserving runtime registration as verifier/admission, not blind trust;
- SHA-locking all source, core IR, target IR, lawpack, compiler, verifier, generated artifact, and assurance evidence;
- integrating HOLMES, Watson, and Moriarty into admission/release workflows;
- supporting schema evolution through deterministic defaults, lawful migrations, projections, versioned operation ABIs, and explicit breaking changes;
- making GraphQL a source profile / migration frontend, not the Continuum protocol.

## Non-Goals

This campaign does not include:

- defining a global Continuum graph;
- forcing every Continuum participant to use Echo;
- forcing every Continuum participant to use GraphQL;
- forcing every Continuum participant to support dynamic YOLO registration;
- proving arbitrary general-purpose programs lawful;
- eliminating privileged/native host extensions in one campaign;
- pretending privileged/native host extensions are normal YOLO contracts;
- making HOLMES, Watson, or Moriarty runtime authorities.

Privileged/native extensions may exist, but they must use a separate trusted-host lane and must not claim compile-time footprint honesty unless they lower to checked target IR with inferred effects.

## Layer Ownership

| Layer                       | Owns                                                                                                                                               | Must Not Own                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Continuum                   | Participant discovery, capability catalogs, lawpack discovery, runtime profile discovery, bundle registration protocol, receipts, YOLO workflow.   | Official storage model, Echo graph doctrine, runtime-specific rewrite semantics hard-coded into core.          |
| Edict Core                  | Deterministic expressions, types, operation declarations, law/profile references, assertions, target imports, effect framework, canonical core IR. | `graph.node`, `graph.edge`, commits, SQL tables, KV primitives, event streams, or any storage-native built-in. |
| Source Frontends            | Edict syntax, GraphQL/Wesley profile, weslaw sidecars, future LawSDL frontends.                                                                    | Runtime authority or target-specific semantics outside declared lawpacks.                                      |
| Wesley / Compiler Substrate | Parsing, normalization, Shape IR/Law IR where applicable, canonicalization, source-profile compiler facts.                                         | Echo dispatch IDs, Echo DPO semantics, Continuum agent policy, privileged runtime authority.                   |
| Lawpacks                    | Domain law, target lowerings, source extensions, verifier profiles, conformance fixtures, compatibility matrices.                                  | Ambient/unversioned semantics or hidden compiler behavior.                                                     |
| Runtime Target Profile      | Target intrinsics, footprint algebra, target IR, verifier rules, bundle profile, obstruction taxonomy.                                             | Universal Continuum semantics.                                                                                 |
| Echo Target                 | Echo DPO/Span IR, graph footprints, Echo op IDs, Echo registration artifacts, Echo generated bindings.                                             | Generic Edict Core or all Continuum storage.                                                                   |
| git-warp Target             | commit/ref/CRDT plan IR, ref/path/reducer footprints, convergence/idempotence checks.                                                              | Echo DPO or graph footprints unless explicitly modeled by a lawpack.                                           |
| Participant Runtime         | Preflight, admission, registration, execution, receipts, obstructions, capability catalog.                                                         | Trusting unverified generated artifacts or raw callbacks in the YOLO lane.                                     |
| HOLMES                      | Assurance over exact SHA-locked evidence and generated artifacts.                                                                                  | Runtime authority or policy override.                                                                          |
| Watson                      | Explanation, repair suggestions, human/agent-readable remediation.                                                                                 | Admission authority.                                                                                           |
| Moriarty                    | Adversarial falsification attempts and exploit-oriented probes.                                                                                    | Admission authority or production mutation.                                                                    |

## Architecture Overview

```text
Author / Agent Source
  Edict / GraphQL-Wesley / weslaw / future LawSDL
        |
        v
Source Frontend
  parse, normalize, typecheck, canonicalize
        |
        v
Edict Core IR / Continuum Law IR
  deterministic expressions, operation declarations,
  abstract effects, law/profile references, target imports
        |
        v
Lawpack + Target Lowering
  selected runtime profile supplies intrinsics,
  target effect rules, target verifier, target IR
        |
        v
Effect + Footprint Inference
  infer target-specific footprint templates
        |
        v
Target Law Profile Check
  Echo DPO checks, git-warp CRDT checks, KV transaction checks,
  event-log append/reducer checks, alias checks, determinism checks
        |
        v
Target IR
  Echo Span IR, git-warp Commit/CRDT IR,
  KV Transaction IR, EventLog Append/Reducer IR, ...
        |
        v
Codegen + Manifest
  generated Rust/TypeScript/codecs/registration/client helpers,
  artifact manifests, target footprint certificates
        |
        v
SHA-lock
  source hash, core IR hash, lawpack digests, target profile,
  target IR hash, artifact hashes, verifier reports, signatures
        |
        v
HOLMES + Watson + Moriarty
  assurance, explanation, adversarial probes
        |
        v
Participant Runtime Preflight + Registration
  verify bundle, register capability, emit receipt or obstruction
```

## Runtime-Neutral Edict Core

Edict Core is the shared deterministic language substrate. It provides:

- type declarations;
- input/output/receipt/obstruction declarations;
- deterministic pure expressions;
- canonical hashing and canonical encoding;
- explicit target imports;
- lawpack imports;
- operation declarations;
- profile/law references;
- assertions;
- bounded branching;
- bounded iteration over canonical finite collections;
- effect inference hooks;
- schema migration/projection declarations;
- generated return values and receipts.

Edict Core must not provide:

- graph nodes or edges;
- commits or refs;
- SQL tables;
- KV keys;
- event streams;
- wall-clock time;
- random numbers;
- network access;
- filesystem access;
- ambient host callbacks;
- scheduler tick authority;
- nondeterministic iteration order;
- unconstrained recursion;
- unbounded loops;
- floating-point operations without a target/lawpack-defined canonical semantics;
- reflection or `eval`.

Storage operations come from target profiles.

## Target Intrinsics

A runtime target profile defines importable intrinsics. For example:

```edict
use target echo.dpo@1 as echo;
```

may expose:

```edict
echo.node<T>(id).read()
echo.node<T>(id).create(value)
echo.node<T>(id).replace(value)
echo.edge<E>(from, to).create(value)
echo.edge<E>(from, to).delete()
echo.attachment<A>(digest).create(bytes)
```

while:

```edict
use target gitwarp.ref_crdt@1 as gw;
```

may expose:

```edict
gw.ref(name).read()
gw.path(path).read()
gw.event<T>(id).create(value)
gw.commit(ref, event)
gw.reduce<T>(ref, reducer)
```

and:

```edict
use target eventlog.append@1 as log;
```

may expose:

```edict
log.stream(name).position().read()
log.stream(name).append<Event>(value)
log.project<View>(stream, reducer)
```

The compiler does not assign universal meaning to these names. The target profile's lawpack defines their types, effects, footprint algebra, lowering, verifier, and obstruction taxonomy.

## Authoring Modes

### Runtime-Native Edict

Runtime-native Edict targets a concrete runtime profile directly.

```edict
contract graft.structural_history v1 {
  use target echo.dpo@1 as echo;

  intent recordGitWarpImportBatch(input: RecordGitWarpImportBatchInput)
    returns RecordGitWarpImportBatchReceipt
    profile echo.createOnly
  {
    let basis = echo.node<StructuralBasis>(input.basisId).read();

    let batchId = hash("GitWarpImportBatch", input.repo, input.commit);

    let batch = echo.node<GitWarpImportBatch>(batchId).create({
      repo: input.repo,
      commit: input.commit,
    });

    echo.edge<BasedOn>(batch, basis).create({});

    return { batchId };
  }
}
```

This operation is intentionally Echo-specific. It lowers to Echo Span IR and graph footprints.

### Portable Semantic Edict

Portable semantic Edict targets an abstract lawpack and can lower to multiple runtime profiles if compatible lowerings exist.

```edict
contract graft.structural_history v1 {
  use lawpack history.optics@1;

  intent recordGitWarpImportBatch(input: RecordGitWarpImportBatchInput)
    returns RecordGitWarpImportBatchReceipt
    implements history.recordEntry
  {
    record history.entry {
      id: hash("GitWarpImportBatch", input.repo, input.commit),
      kind: "gitWarpImportBatch",
      repo: input.repo,
      commit: input.commit,
      basis: input.basisId,
    };

    return { batchId: entry.id };
  }
}
```

A compiler may then target:

```bash
edict compile --target echo.dpo@1 graft.edict
edict compile --target gitwarp.ref_crdt@1 graft.edict
edict compile --target eventlog.append@1 graft.edict
```

Only targets with lawpack-provided lawful lowerings are accepted.

## Runtime Target Profiles

A target profile declares:

- profile identity and version;
- accepted Edict Core ABI;
- importable target intrinsics;
- footprint algebra;
- target IR format;
- target verifier ABI;
- generated artifact profiles;
- bundle profile;
- obstruction taxonomy;
- deterministic standard-library extensions;
- canonical encoding rules;
- schema/version compatibility rules;
- conformance fixtures;
- signatures and revocation/update channel.

Example profile families:

| Runtime target       | Target IR            | Footprint algebra                                               | Verifier checks                                                                                                               |
| -------------------- | -------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `echo.dpo@1`         | Echo Span IR         | graph node/edge/attachment reads/writes/creates/deletes/forbids | typed DPO well-formedness, pushout complement side conditions, alias checks, boundary preservation, graph footprint soundness |
| `gitwarp.ref_crdt@1` | Commit/Reducer IR    | refs, paths, object IDs, merge bases, reducers                  | deterministic commit plan, idempotent event identity, CRDT convergence, reducer monotonicity, ref/path footprint soundness    |
| `kv.transactional@1` | Transaction/CAS IR   | keys, ranges, compare guards                                    | deterministic reads/writes, CAS guards, serializability profile, key/range footprint soundness                                |
| `eventlog.append@1`  | Append/Projection IR | streams, positions, event types, projections                    | append-only discipline, reducer determinism, projection law, stream footprint soundness                                       |

## Footprint Inference

Footprints are target-specific. The generic concept is:

```text
Footprint<TargetProfile>
```

The compiler infers footprints from typed effects in the selected target algebra.

For Echo:

```text
read echo.node<StructuralBasis>(input.basisId)
```

may infer:

```text
reads:
  node StructuralBasis[input.basisId]
```

For git-warp:

```text
gw.ref("refs/continuum/history").read()
gw.commit(ref, event)
```

may infer:

```text
reads:
  ref refs/continuum/history
writes:
  ref refs/continuum/history
  path history/events/<entry-id>
```

For event-log:

```text
log.stream("history").append<HistoryEntryRecorded>(event)
```

may infer:

```text
writes:
  append stream history event HistoryEntryRecorded
```

A declared footprint, when present, is a policy bound, not the source of truth:

```text
computedFootprint <= declaredMaxFootprint
```

Underclaiming rejects. Overclaiming may pass but reduces scheduling/admission precision.

## Static Templates and Runtime Instantiation

Many footprints are parametric:

```text
reads:
  Document[input.documentId]
```

At runtime, a concrete submission instantiates the template:

```text
reads:
  Document["doc_123"]
```

The compiler proves the template is lawful. Runtime preflight checks concrete aliasing, current-state applicability, policy, and target-specific side conditions.

## Echo DPO Lowering

For Echo only, target lowering produces Span IR.

A DPO rule has the form:

```text
L <- K -> R
```

where:

- `L` is the matched left side;
- `K` is the preserved interface/boundary;
- `R` is the right side;
- the runtime graph state is decomposed into a pushout complement plus the matched focus;
- applying the rule replaces `L \ K` with `R \ K` while preserving the complement and boundary.

Echo DPO checks include:

- typed graph well-formedness;
- `K -> L` and `K -> R` morphism validity;
- monomorphism requirements;
- dangling condition;
- identification condition;
- negative/application conditions;
- boundary preservation for lens-like profiles;
- deterministic attribute expression fragment;
- computed graph footprint soundness;
- generated handler context does not expose raw mutation authority.

Span IR is not used for git-warp, KV, event-log, or other non-DPO targets unless a target explicitly adopts it.

## Runtime Profiles Beyond Echo

### git-warp Commit/CRDT Target

A git-warp target may interpret a portable history operation as:

```text
read current ref
construct canonical event object
create commit containing the event
attempt ref update
merge or reduce concurrent events through declared CRDT reducer
```

Verifier checks may include:

- deterministic event identity;
- canonical commit payload;
- append/idempotence law;
- reducer associativity/commutativity/idempotence where required;
- ref/path footprint soundness;
- convergence under concurrent submissions;
- no hidden wall-clock/random input.

### KV Transaction Target

A KV target may interpret an operation as:

```text
read declared keys/ranges
verify compare guards
write declared keys
commit atomically under target serializability profile
```

Verifier checks may include:

- deterministic key derivation;
- no unbounded range scan unless profile permits it;
- CAS guards for write conflicts;
- key/range footprint soundness;
- canonical value encoding.

### Event Log Target

An event-log target may interpret an operation as:

```text
append a canonical event to a stream
project through a deterministic reducer
```

Verifier checks may include:

- append-only discipline;
- event schema compatibility;
- reducer determinism;
- projection law;
- stream footprint soundness;
- obstruction if required stream position or causality basis does not hold.

## Lawfulness as Denotation Preservation

A portable semantic operation has an abstract denotation:

```text
semanticOperation : SemanticView × Input -> SemanticView × Output
```

A runtime target provides an observation/projection function:

```text
observe_R : RuntimeState_R -> SemanticView
```

A target implementation is lawful when the following commutes, modulo the target's declared equivalence relation:

```text
observe_R(apply_R(state, input))
  == semanticOperation(observe_R(state), input)
```

Echo proves this through DPO/Span side conditions. git-warp may prove it through commit/reducer/CRDT laws. KV may prove it through transaction/CAS laws. Event-log targets may prove it through append/projection laws.

No global graph is required.

## Operation Profiles

Operation profiles may be portable or target-specific.

Portable examples:

- `readOnly`;
- `appendOnlyHistoryEntry`;
- `idempotentCreate`;
- `replacementLens`;
- `disjointTraversal`;
- `monotoneProjection`.

Echo-specific examples:

- `echo.createOnly`;
- `echo.boundaryReplacementLens`;
- `echo.generalDpoRewrite`.

git-warp-specific examples:

- `gitwarp.appendEvent`;
- `gitwarp.refCrdtReduce`;
- `gitwarp.idempotentCommit`.

A general rewrite/transaction/commit plan may be legal without being a lawful lens. The compiler must distinguish:

```text
accepted as target operation
accepted as lawful optic/lens/traversal
```

## Compiler Errors, Registration Errors, Runtime Obstructions

The system uses three failure classes.

### Compiler Error

Source or target lowering is invalid before artifacts exist.

Examples:

- nondeterministic API use;
- target intrinsic not imported;
- unsupported target profile;
- invalid Echo DPO rule;
- git-warp reducer does not satisfy required law profile;
- declared footprint underclaims inferred footprint;
- schema required field is missing;
- operation claims lens profile but violates side conditions.

### Registration / Admission Error

The bundle is unsupported, tampered, stale, unverified, or not admitted by participant policy.

Examples:

- lawpack digest mismatch;
- compiler/verifier ABI mismatch;
- target runtime profile unsupported;
- generated artifact hash mismatch;
- HOLMES report does not match bundle hash;
- signature missing or revoked;
- participant policy rejects requested capability class.

### Runtime Obstruction

The operation is valid, registered, and well-formed, but cannot apply to the current runtime state.

Examples:

- Echo match absent or ambiguous;
- Echo concrete alias collision violates DPO identification condition;
- git-warp ref changed and reducer policy cannot merge;
- KV CAS guard failed;
- event-log stream position no longer matches required basis;
- participant policy blocks this submission at current causal basis.

## Aliasing and Runtime-Specific Side Conditions

Static footprint templates may be lawful but instantiate into illegal concrete effects.

Example:

```text
read input.x
preserve input.y
delete input.x
```

If `input.x == input.y`, Echo DPO lowering may violate the identification condition by deleting and preserving the same concrete node.

The compiler and runtime split is:

- static compiler checks template shape and required assertions;
- runtime preflight checks concrete aliases and target topological constraints;
- failure becomes a typed obstruction such as `ECHO-LAW-ALIAS-COLLISION`.

Target profiles may choose to force explicit static assertions for some classes:

```edict
assert input.x != input.y;
```

but concrete runtime preflight remains mandatory.

## FIDLAR Anti-Pattern

FIDLAR means:

```text
Footprints Ignored; Developer Lies About Risk
```

A system is FIDLAR-shaped when it asks an author to declare a footprint, then grants the implementation enough raw authority to exceed it.

FIDLAR examples:

```text
@echo_footprint(reads: ["A"], writes: ["B"])
fn callback(ctx: RawRuntimeContext) {
  // can read C, write D, call wall clock, access network, mutate global state
}
```

YOLO contracts must not be FIDLAR-shaped.

If an operation requires privileged/native host code, it must use a separate privileged extension lane with explicit trust policy. It must not claim compile-time footprint honesty unless it lowers to target IR with inferred effects and verified artifacts.

## Generated Artifacts

A successful compile may emit target-specific generated artifacts.

Common outputs:

- operation input/output/receipt types;
- target-specific codecs;
- operation constants and metadata;
- footprint templates;
- runtime footprint instantiation helpers;
- registration helpers;
- typed client helpers;
- observation/request helpers;
- obstruction/result decoders;
- artifact manifest constants;
- SHA-lock metadata.

Echo-specific outputs may include:

- Echo op IDs;
- Echo DPO/Span registry entries;
- Echo contract package constructors;
- Echo graph footprint certificates;
- Echo TypeScript registration/bootstrap helpers;
- Echo Rust package/handler adapter code.

git-warp-specific outputs may include:

- commit plan descriptors;
- reducer descriptors;
- ref/path footprint templates;
- CRDT evidence;
- generated client helpers for commit/observe flows.

## App-Facing Registration Helpers

Generated TypeScript should avoid manual type/codec/operation registration boilerplate.

A generated bundle helper may expose:

```ts
export const GRAFT_STRUCTURAL_HISTORY_CONTRACT: GeneratedContractBundle;

export async function registerGraftStructuralHistoryContract(
  participant: ContinuumYoloParticipant
): Promise<ContractRegistrationReceipt>;

export function createGraftStructuralHistoryClient(
  participant: ContinuumCapabilityPort
): GraftStructuralHistoryClient;
```

Registration installs or advertises, depending on target profile:

- package identity;
- source profile;
- lawpack digests;
- runtime target profile;
- schema/law/core IR/target IR hashes;
- type descriptors;
- operation registry entries;
- codec bindings;
- target footprint templates;
- generated artifact hashes;
- verifier reports;
- assurance report references;
- package/version metadata.

Application code must not manually bind generated operation names, target IDs, codecs, or type descriptors to the runtime in the YOLO lane.

## Participant APIs

Continuum defines protocol surfaces. Participant runtimes implement them.

```ts
export interface ContinuumYoloParticipant {
  describeParticipant(): Promise<ParticipantDescriptor>;

  listAcceptedSourceProfiles(): Promise<SourceProfileRef[]>;

  listAcceptedLawpacks(): Promise<LawpackRef[]>;

  listAcceptedRuntimeTargets(): Promise<RuntimeTargetProfileRef[]>;

  listAcceptedBundleProfiles(): Promise<BundleProfileRef[]>;

  listCapabilities(): Promise<CapabilityCatalog>;

  preflightBundle(bundle: ContractBundle): Promise<ContractPreflightReport>;

  registerBundle(bundle: ContractBundle): Promise<ContractRegistrationReceipt>;
}
```

A participant may support existing capability invocation without supporting dynamic YOLO registration.

A participant may support YOLO bundle registration without offering a compile service. Agents can compile locally or through another compiler participant, then submit the bundle for preflight/registration.

## Capability Catalog vs Lawpack Catalog

Agents should distinguish:

```text
Capability Catalog = what can I invoke now?
Lawpack Catalog    = what laws can I author new capabilities under?
Runtime Target Catalog = what storage/execution profiles can this participant admit?
```

Existing capability invocation does not require compilation.

New capability creation requires lawpack resolution, target profile selection, compilation, assurance, and admission.

## Lawpacks

A lawpack declares:

- identity, version, digest;
- source profiles it supports;
- Edict Core ABI compatibility;
- runtime target profiles it can lower to;
- directive or syntax extensions, if any;
- semantic law profiles;
- target lowering compiler ABI;
- verifier ABI;
- generated artifact profiles;
- conformance fixtures;
- compatibility matrix;
- source/reproducible build evidence;
- signatures and revocation/update channel.

A lawpack may be:

- purely domain-semantic;
- runtime-target-specific;
- an adapter from a domain lawpack to a runtime target;
- a source-profile extension;
- a verifier-only package.

Example stack:

```text
lawpack:history.optics@1
  defines abstract record/read/update history semantics

lawpack:echo.history.dpo@1
  lowers history.optics@1 -> echo.dpo@1

lawpack:gitwarp.history.ref_crdt@1
  lowers history.optics@1 -> gitwarp.ref_crdt@1
```

## GraphQL / Wesley / weslaw Posture

GraphQL is a source/profile frontend, not the Continuum protocol and not the semantic core.

Wesley should provide GraphQL parsing/lowering and neutral compiler facts where useful:

```text
GraphQL SDL -> Shape IR
weslaw/v1 -> Law IR
Shape IR + Law IR -> source-profile facts and hashes
```

Wesley must not define Echo DPO, Echo operation IDs, Continuum agent policy, or runtime admission semantics.

GraphQL may remain useful for:

- migration from existing app schemas;
- shape import/export;
- app developer familiarity;
- generated API documentation;
- compatibility with existing tooling.

Edict/weslaw/LawSDL may eventually define shape directly. The canonical artifact is the contract bundle, not the GraphQL source text.

## Schema Evolution

Schema evolution does not imply runtime target version changes.

Version axes are separate:

| Axis            | Example                       | Bump when                                            |
| --------------- | ----------------------------- | ---------------------------------------------------- |
| Source language | `edict@1`                     | syntax or language semantics change                  |
| Runtime target  | `echo.dpo@1`                  | target execution/footprint/verifier semantics change |
| Lawpack         | `history.optics@2.1.0`        | domain law or lowering semantics change              |
| Schema epoch    | `GitWarpImportBatch@v2`       | domain shape changes                                 |
| Operation ABI   | `recordGitWarpImportBatch@v2` | callable input/output/effect contract changes        |
| Bundle identity | `bundleHash`                  | any compiled evidence changes                        |

If `GitWarpImportBatch` gains a new required field, the compiler must force one of:

- explicit value provided by new operation input;
- deterministic default/initializer;
- lawful migration operation;
- lawful projection adapter;
- versioned legacy operation ABI;
- explicit breaking change.

It must not silently reinterpret old target IR under the new schema.

Migrations are lawful operations. They compile, infer footprints, lower to target IR, SHA-lock, register, and emit receipts like any other YOLO operation.

## SHA-lock

Every compiled contract bundle must bind at least:

- source profile ID/version;
- source hash;
- Edict Core IR hash;
- lawpack IDs/versions/digests;
- target runtime profile ID/version;
- target lowering compiler identity and digest;
- target IR hash;
- inferred footprint template hash;
- generated artifact hashes;
- manifest hash;
- verifier report hash;
- HOLMES report hash when applicable;
- Watson remediation report hash when included;
- Moriarty probe report hash when included;
- signatures and signer identities;
- conformance fixture references when applicable.

For Echo, `targetIRHash` is the Echo Span IR hash.

For git-warp, `targetIRHash` is the Commit/Reducer IR hash.

For KV, `targetIRHash` is the Transaction/CAS IR hash.

For event-log, `targetIRHash` is the Append/Projection IR hash.

## HOLMES + Watson + Moriarty

### HOLMES

HOLMES performs assurance over exact SHA-locked evidence. HOLMES should answer:

- which source, core IR, target IR, lawpacks, target profiles, compilers, verifiers, generated artifacts, and reports were assured?
- were the hashes exact?
- did the target verifier pass?
- did generated artifacts match the manifest?
- did schema/law/profile compatibility hold?
- did the bundle avoid FIDLAR-shaped trust gaps?
- what assurance tier was achieved?

HOLMES does not execute production mutations and does not override runtime admission.

### Watson

Watson explains compiler, verifier, HOLMES, and Moriarty findings. Watson should produce:

- human-readable explanations;
- agent-readable repair plans;
- likely fixes;
- relevant schema coordinates;
- relevant lawpack/profile references;
- minimized examples;
- safe migration suggestions.

Watson does not admit bundles.

### Moriarty

Moriarty adversarially probes candidate bundles. It should attempt:

- nondeterminism injection;
- footprint underclaiming;
- target intrinsic misuse;
- alias/identification failures;
- DPO boundary mutation for Echo;
- CRDT convergence breakage for git-warp;
- KV range overreach;
- event-log projection divergence;
- schema evolution ambiguity;
- lawpack confusion or digest substitution;
- generated artifact tampering;
- supply-chain substitution;
- FIDLAR laundering through privileged host callbacks.

Moriarty produces evidence. Runtime admission remains with the participant runtime/policy.

## Determinism Posture

Edict Core and target profiles must define deterministic semantics.

Allowed only when deterministic and profile-defined:

- canonical hashing;
- canonical binary/JSON encoding;
- integer arithmetic with explicit overflow behavior;
- string operations with explicit Unicode/canonicalization policy;
- bounded collection operations with canonical ordering;
- target intrinsics with declared effects and verifier rules.

Forbidden in the YOLO lane unless explicitly modeled as input/provenance:

- wall-clock time;
- randomness;
- ambient environment variables;
- network IO;
- filesystem IO;
- host callbacks;
- scheduler ticks;
- nondeterministic iteration;
- locale-dependent comparison;
- implicit actor/user/current-machine identity;
- hidden global state.

If actor/provenance is needed, it must be explicit in operation input or runtime provenance evidence and must be hash-bound in the bundle/receipt.

## Data / State Model

Continuum does not define state. Participant runtime profiles define state models.

| Target    | State model                                  | Operation form              | Footprint form                       |
| --------- | -------------------------------------------- | --------------------------- | ------------------------------------ |
| Echo      | typed graph / WARP graph                     | DPO rewrite / observation   | graph node/edge/attachment footprint |
| git-warp  | git refs, commits, trees, reducers           | commit + CRDT reduction     | ref/path/reducer footprint           |
| KV        | key-value store with transaction/CAS profile | transaction plan            | key/range/guard footprint            |
| event-log | streams and projections                      | append + reducer/projection | stream/event/projection footprint    |

Continuum standardizes how these targets are declared, discovered, compiled against, SHA-locked, assured, submitted, and receipted.

## Lower Modes

### Local Deterministic Compile Mode

Compilation must be possible locally without network access if all referenced lawpacks, profiles, compilers, verifiers, and conformance fixtures are available by digest.

Same inputs must produce byte-identical outputs:

```text
source + sourceProfile + lawpacks + targetProfile + compiler + options
  -> same core IR
  -> same target IR
  -> same artifacts
  -> same manifest
```

### Participant Preflight Mode

A participant runtime may preflight a bundle without registering it.

Preflight checks:

- profile support;
- lawpack support;
- hash validity;
- target verifier result;
- policy/admission class;
- requested capability class;
- generated artifact manifest;
- known revocations;
- optional current-state applicability where meaningful.

### Registration Mode

Registration installs or advertises a capability in the participant runtime and emits a receipt.

Registration must not grant scheduler tick authority to app/agent code unless the runtime profile explicitly models that as a privileged non-YOLO lane.

## Acceptance Criteria

- Continuum design text explicitly states that Continuum has no official storage runtime.
- Edict Core contains no graph-native built-ins.
- Echo graph primitives are available only through an imported Echo runtime target profile.
- Span IR is documented as Echo DPO target IR, not universal Continuum IR.
- Runtime target profiles define their own footprint algebra.
- Contract bundles are registered with participant runtimes, not a global Continuum runtime.
- A participant can advertise YOLO support without supporting Echo DPO.
- A participant can support existing capability invocation without supporting dynamic bundle registration.
- Declared footprints are never the sole source of truth for operation effects.
- Target-specific footprints are inferred from checked source/Core IR/target IR.
- FIDLAR-shaped callbacks are rejected from the YOLO lane.
- Echo DPO operations that fail DPO well-formedness do not generate Echo artifacts.
- git-warp operations that fail reducer/convergence/idempotence checks do not generate git-warp artifacts.
- Runtime state applicability failures become typed obstructions, not compiler failures.
- Generated registration helpers include type/codec/operation/manifest bootstrap code so apps do not manually wire generated contracts to participant runtimes.
- SHA-lock binds source, core IR, target IR, lawpack digests, target profile, generated artifacts, verifier reports, and assurance reports.
- HOLMES assurance reports are bound to target runtime profile and target IR hash.
- Watson can explain compiler/verifier/HOLMES/Moriarty failures.
- Moriarty can probe target-specific law failures.
- GraphQL is documented as a source profile/frontend, not the Continuum protocol.

## RED Witnesses To Add

- `edict_core_has_no_graph_builtins`
- `span_ir_is_echo_target_ir_not_universal_ir`
- `participant_can_advertise_yolo_without_echo_dpo`
- `runtime_target_profile_declares_footprint_algebra`
- `declared_footprint_underclaim_rejects_compile`
- `fidlar_raw_callback_rejected_from_yolo_lane`
- `echo_dpo_invalid_identification_condition_obstructs_runtime_preflight`
- `echo_dpo_invalid_rule_fails_compile`
- `gitwarp_reducer_nonconvergent_fails_compile`
- `kv_unbounded_range_scan_rejected_without_profile_permission`
- `eventlog_projection_nondeterminism_fails_compile`
- `generated_registration_helper_registers_type_codec_operation_manifest`
- `bundle_target_profile_digest_mismatch_rejects_registration`
- `holmes_report_hash_bound_to_bundle_hash`
- `moriarty_detects_fidlar_laundering_attempt`
- `graphql_profile_lowers_to_core_ir_without_becoming_protocol_requirement`

## Migration Plan

1. Land this runtime-neutral design revision.
2. Update terminology: `Span IR` becomes `Echo Span IR` or `Echo DPO Span IR` where needed.
3. Split Edict Core from Echo target intrinsics in docs and prototypes.
4. Define the first target profile manifest shape.
5. Define `echo.dpo@1` as the first concrete target profile.
6. Move Echo graph primitives behind `use target echo.dpo@1`.
7. Define target-specific footprint inference APIs.
8. Define target-specific bundle profile and SHA-lock manifest fields.
9. Wire HOLMES reports to target profile + target IR hash.
10. Add Watson explanation fixtures for compiler/registration/obstruction failures.
11. Add Moriarty adversarial probes for FIDLAR, target aliasing, and artifact substitution.
12. Migrate existing Echo-Wesley/Graft structural-history generation to the target-profile model.
13. Add a second minimal non-Echo target profile fixture, even if toy, to prove the architecture does not require a graph.
14. Keep GraphQL/Wesley as a source profile during migration.

## Risks

- Over-generalizing too early may slow the first Echo use case. Mitigation: make `echo.dpo@1` the first concrete target while keeping Edict Core clean.
- Under-specifying target profiles may let hidden runtime semantics leak into compilers. Mitigation: require target profiles to declare intrinsics, effects, footprints, target IR, verifier ABI, and conformance fixtures.
- Calling everything an optic may blur lawful lens/traversal/profile distinctions. Mitigation: use operation profiles and target verifier certificates precisely.
- Lawpack dependency resolution may become supply-chain risk. Mitigation: SHA-lock, signatures, reproducible builds, conformance fixtures, and revocation channels.
- Runtime preflight may become inconsistent across participants. Mitigation: target profile conformance suites and HOLMES evidence.
- Privileged host lanes may try to launder FIDLAR operations as YOLO. Mitigation: explicit FIDLAR rejection criteria and Moriarty probes.

## Relapse Checks

- Do not describe Continuum as having a global graph.
- Do not put Echo graph primitives in Edict Core.
- Do not make Span IR the only possible compiled target.
- Do not assume all lawful operations are DPO rewrites.
- Do not require non-Echo participants to implement Echo's footprint algebra.
- Do not let apps manually orchestrate raw Wesley/Echo/git-warp compiler stages for YOLO contracts.
- Do not trust declared footprints without compiler-inferred effects.
- Do not claim compile-time footprint honesty if app code receives raw runtime mutation authority.
- Do not let GraphQL directives become the permanent semantic core.
- Do not let HOLMES, Watson, or Moriarty become hidden admission authorities.

## Review Notes

Approved north star:

```text
Continuum standardizes lawful operation, not storage.
Edict Core standardizes deterministic effects, not graph primitives.
Runtime target profiles define storage interpretation, footprint algebra, and verifier rules.
Participant runtimes admit SHA-locked bundles.
```

Short slogan:

```text
No universal store. Universal law shape.
```

Internal bumper sticker:

```text
Continuum kills FIDLAR with YOLO.
```
