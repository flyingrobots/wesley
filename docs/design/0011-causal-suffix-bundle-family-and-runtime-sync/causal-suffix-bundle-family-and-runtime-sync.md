---
title: Causal Suffix Bundle Family And Runtime Sync
legend: SOURCE
packet: 0011-causal-suffix-bundle-family-and-runtime-sync
status: design
release: future
---

# Causal Suffix Bundle Family And Runtime Sync

## Sponsors

- Human: I can author one shared family for hot/cold runtime handoff without
  smearing Echo and `git-warp` semantics into private adapter folklore.
- Agent: I can explain exactly which parts of witnessed suffix sync are
  authored in Continuum, compiled in Wesley, and implemented by the runtimes.

## Hill

Wesley grows an explicit compiler/publication boundary for the shared
`CausalSuffixBundle` family so Echo and `git-warp` can exchange witnessed
causal suffixes over one shared witnessed causal history without pretending
synchronization is state replication.

## Scope Hard Condition

This packet only counts as useful if a maintainer can answer all of the
following without folklore:

- which repo authors the shared suffix bundle family
- which bundle and import-result nouns Wesley is responsible for compiling
- which parts stay engine-local in Echo and `git-warp`
- how transport-safe Rust and TypeScript surfaces are traced back to the
  authored family
- why the compiler must not absorb engine-local admission law into itself

## Why This Exists

The stack now has two complementary doctrines:

- Continuum promises one shared witnessed causal history across multiple runtime
  temperatures
- Echo and `git-warp` should exchange witnessed causal suffixes rather than
  synchronized state

That still leaves the compiler/publication seam underspecified.

The suffix exchange boundary must not become:

- handwritten DTO folklore in each runtime
- one-off bridge glue that only one language can consume
- a second hidden ontology owned by Wesley

Wesley should instead compile the shared family into portable artifacts while
leaving admission and storage mechanics to the runtimes.

## Core Split

Wesley should preserve four different layers.

### 1. Authored shared family

Continuum-authored and semantic.

This declares the shared transport-facing nouns, such as:

- `CausalSuffixBundle`
- `ExportSuffixRequest`
- `ImportAdmissionResult`
- bundle witness, signature, and payload reference helpers

### 2. Compiled family artifacts

Wesley-produced and portable.

This is the language/runtime-facing output:

- Rust types and codecs
- TypeScript types and codecs
- JSON/schema manifest identity
- publication metadata tying the artifacts back to the authored family

### 3. Engine-local runtime law

Echo and `git-warp` owned.

This includes:

- frontier normalization
- storage and checkpoint strategy
- loop detection details
- settlement and admission mechanics
- branch/lane persistence strategy

### 4. Transport and tool usage

Host/tool owned.

This includes:

- exchanging frontier summaries
- asking for missing suffixes
- feeding a bundle into import
- inspecting receipts and witnesses

These layers must remain distinct. If Wesley absorbs engine-local import law,
it stops being a compiler and starts pretending to be the runtime.

## What Wesley Should Compile

For an admitted suffix-sync family, Wesley should compile:

1. one authored request family for suffix export
2. one authored bundle family for witnessed causal suffixes
3. one authored import outcome family
4. one codec set for bundle witnesses, payload refs, checkpoint refs, and
   optional wormhole records
5. one manifest/publication trail tying the generated artifacts to the authored
   family version

The main outputs should be:

- Rust struct and enum surfaces
- Rust serialization codecs
- TypeScript type surfaces
- TypeScript validation or codec surfaces
- operation registries or helper builders where the surrounding family shape
  uses them
- manifest traceability proving which authored family and version produced the
  artifacts

## What Wesley Must Not Compile

Wesley must not normalize engine-local runtime behavior into shared family
truth.

In particular:

- no hidden admission policy
- no hidden canonical-branch mutation rules
- no last-write-wins fallback
- no private loop-detection folklore that is not published by the runtimes
- no assumption that payload/checkpoint availability implies full state
  equivalence

The family declares interoperable nouns and envelope structure.
The runtimes still decide how those bundles are admitted.

## Initial Family Shape

The first serious authored family should assume at least these shapes:

- `ExportSuffixRequest`
- `CausalSuffixBundle`
- `PayloadRef`
- `CheckpointRef`
- `WormholeRecord`
- `ExportWitness`
- `ImportAdmissionResult`
- `Receipt`
- `ObstructionWitness`

That is enough to support:

- one-way Echo -> `git-warp` export/import
- duplicate-import idempotence proof
- later reverse import from `git-warp` -> Echo

## Relationship To Existing Families

This family should sit adjacent to, not inside:

- receipt families
- witness families
- neighborhood core
- settlement/reintegration publication

The bundle family carries the claim being handed off.
Settlement and receipts explain how the receiving runtime treated that claim.

## Relationship To Echo

Echo should not hand-author its own permanent transport DTOs for suffix sync.

Echo should consume Wesley-generated Rust artifacts for the shared family, then
apply Echo-local runtime law when implementing:

- `export_suffix`
- `import_suffix`

## Relationship To git-warp

`git-warp` should likewise consume the shared generated family rather than
inventing a parallel transport vocabulary.

It remains free to:

- store the history differently
- settle imports differently
- expose colder archival affordances

so long as it publishes the same shared family categories.

## Immediate Next Step

The next implementation lane should be:

1. author the shared suffix-sync family in Continuum
2. teach Wesley to compile the family into Rust and TypeScript codecs
3. prove one Echo export artifact against the generated Rust side
4. prove one receiving consumer can decode and inspect the bundle on the
   TypeScript side
5. then prove one real Echo -> `git-warp` import path end to end
