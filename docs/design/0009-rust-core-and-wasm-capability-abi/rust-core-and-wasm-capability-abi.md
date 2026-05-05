---
title: Wesley Rust Core And WASM Capability ABI
legend: RUNTIME
packet: 0009-rust-core-and-wasm-capability-abi
status: design
release: future
---

# Wesley Rust Core And WASM Capability ABI

## Sponsors

- Human: I can use Wesley inside Rust systems such as Echo without shelling to
  Node, while keeping TypeScript module authoring available where it is still
  the best developer experience.
- Agent: I can explain which layer owns compiler truth, which layer owns
  extension execution, and which layer owns host-specific runtime integration
  without collapsing Rust, TypeScript, WASM, and Node into one foggy plugin
  story.

## Hill

Wesley grows a Rust-native compiler kernel and a host-neutral capability ABI so
Echo can call Wesley in-process, Node can keep the current CLI and TypeScript
module DX, and portable extensions can cross host boundaries through WASM
without making TypeScript or Node part of the compiler core.

## Why This Cycle Exists

The current release branch has clarified Wesley's identity:

- Wesley is the core `GraphQL -> whatever` compiler and assurance toolchain.
- The `whatever` comes from explicit external modules.
- Domain behavior belongs outside generic Wesley.
- Module capability loading is the seam between base verbs and module-owned
  behavior.

That architecture is right, but the implementation is still JavaScript-first.
That is fine for the current CLI, but it is the wrong center of gravity for
Rust-native consumers such as Echo.

Echo should be able to call the compiler kernel as a Rust library. It should
not need to spawn Node, parse JSON as the only integration path, or trust a
JavaScript runtime just to lower authored GraphQL into canonical Wesley truth.

The older [Rust core note](../../RustCore.md) already named the rough target.
This packet makes the boundary stricter:

```text
Rust owns the compiler kernel.
WASM owns the portable capability ABI.
Node owns TypeScript module hosting.
Echo owns Echo runtime semantics.
```

The point is not to rewrite everything. The point is to make the smallest hard
boundary that lets every host stay honest.

## Human Users / Jobs / Hills

### Primary Human Users

- Wesley maintainers evolving the compiler and module runtime
- Echo maintainers who need in-process schema/compiler truth in Rust
- module authors choosing between Rust, WASM, and TypeScript extension modes
- release operators auditing which host executed which capabilities

### Human Jobs

1. Decide whether a behavior belongs in the Rust kernel, a WASM capability, a
   TypeScript module, a host adapter, or an external domain module.
2. Embed Wesley in Echo without a Node subprocess in the critical path.
3. Keep existing TypeScript module authoring viable for the Node CLI.
4. Review release evidence that proves which core and capability engines ran.

### Human Hill

A maintainer can point to one architecture and say: "this is compiler truth,
this is portable extension execution, this is Node-only TypeScript hosting, and
this is Echo-owned runtime behavior."

## Agent Users / Jobs / Hills

### Primary Agent Users

- agents designing future Wesley cycles
- agents auditing module trust and host/runtime boundaries
- agents comparing JS and Rust compiler outputs for parity
- agents generating fixture modules or WASM capability harnesses

### Agent Jobs

1. Identify whether a proposed change contaminates the Rust kernel with host
   behavior.
2. Generate parity fixtures where JS and Rust lowering must agree.
3. Inspect a module-load report and know whether a capability ran as Rust,
   WASM, or TypeScript.
4. Explain why TypeScript remains supported without becoming the portable ABI.

### Agent Hill

An agent can inspect a Wesley run and answer which kernel produced the IR, which
host loaded capabilities, which capability ABI was used, and which artifacts or
evidence were emitted.

## Core Split

The design has four layers.

### 1. Rust Kernel

The Rust kernel owns deterministic compiler truth.

It should own:

- GraphQL SDL parsing
- Wesley directive validation
- canonical IR construction
- canonical serialization rules
- schema, IR, layout, registry, and bundle hash primitives
- pure validation helpers
- core error codes and diagnostics
- capability ABI schema definitions

It must not own:

- TypeScript module execution
- Node module discovery
- filesystem policy
- network policy
- release workflow orchestration
- Echo runtime semantics
- PostgreSQL, Supabase, Continuum, or product behavior

The Rust kernel should be usable as:

- a Cargo crate for Rust hosts
- a Node binding through N-API or WASM
- a WASM package for browser or constrained hosts when needed

### 2. Capability ABI

The capability ABI is the data contract between the kernel/host and extension
code.

The ABI should be:

- data-first
- explicit about inputs and outputs
- deterministic by default
- host-neutral
- versioned independently from any one host language
- able to describe diagnostics, artifacts, evidence, and capability summaries

The first portable ABI should be narrow. A good first slice is one pure
`wesley.targets` compile capability or one pure generator capability. Do not
start with the whole Holmes/Watson/Moriarty/BLADE surface.

### 3. Host Adapters

Host adapters own runtime integration.

Node owns:

- current CLI process integration
- TypeScript module loading
- current `wesley.config.mjs` and `WESLEY_MODULES` behavior
- N-API or WASM binding to the Rust kernel
- normalization of TypeScript modules into the shared capability/report shape

Rust hosts own:

- in-process calls to `wesley-core-rs`
- Rust-native capability registration
- WASM component execution through a Rust runtime
- Echo-side integration when Echo chooses to consume Wesley directly

Browser or edge hosts own:

- WASM kernel loading
- constrained capability execution
- local-only storage and fetch policy

### 4. Domain Modules

Domain modules own target semantics.

That stays true even if the kernel moves to Rust.

Examples:

- Echo/Continuum modules own Echo and Continuum-specific compile targets.
- `wesley-postgres` owns PostgreSQL and Supabase behavior.
- project modules own project policy and local helper commands.

Rust core is not permission to move domain behavior back into generic Wesley.

## Extension Modes

Wesley should support three extension modes under one capability contract.

| Mode | Host | Use |
| --- | --- | --- |
| Rust-native capability | Rust hosts | Echo in-process, high-trust native integrations |
| WASM capability | Rust, Node, browser, CI | portable capability execution |
| TypeScript module | Node host | fast authoring and current CLI DX |

The important rule:

> TypeScript is a Node-hosted convenience layer. WASM is the portable extension
> boundary. Rust is the compiler kernel.

Do not embed TypeScript directly into the Rust kernel as the primary extension
story. If TypeScript-authored extensions eventually compile to WASM through a
separate toolchain, they should still enter through the WASM capability ABI.

## Proposed Runtime Shape

```text
Authored GraphQL SDL
  -> Wesley Rust Kernel
      -> Canonical IR
      -> Hashes / diagnostics
      -> Capability input envelope

Capability execution
  -> Rust-native capability
  -> WASM component capability
  -> TypeScript module normalized by Node host

Outputs
  -> artifacts
  -> evidence
  -> module-load report
  -> capability execution report
```

The core kernel produces truth. Hosts execute capabilities. Reports preserve the
boundary.

## Minimal Rust API Shape

The Rust crate should start boring and data-first.

```rust
pub fn lower_sdl(input: LowerInput) -> Result<LowerOutput, WesleyDiagnosticSet>;
pub fn validate_ir(input: ValidateIrInput) -> Result<ValidateIrOutput, WesleyDiagnosticSet>;
pub fn canonicalize_ir(input: CanonicalizeIrInput) -> Result<Vec<u8>, WesleyDiagnosticSet>;
pub fn compute_hashes(input: HashInput) -> Result<HashOutput, WesleyDiagnosticSet>;
pub fn describe_capability_abi() -> CapabilityAbi;
```

The first implementation may return canonical JSON bytes. A later
implementation may add a compact binary encoding, but JSON parity is the first
truth anchor because the current JS system already has JSON fixtures.

## Minimal Capability ABI Shape

The first ABI should avoid object-runtime assumptions.

Conceptually:

```text
CapabilityInfo
CapabilityInputEnvelope
CapabilityOutputEnvelope
Diagnostic
Artifact
EvidenceEntry
CapabilitySummary
```

If WIT/component-model support is used, the initial shape should still stay
small:

```wit
record diagnostic {
  code: string,
  message: string,
  severity: string,
}

record artifact {
  path: string,
  content: list<u8>,
  media-type: option<string>,
}

record capability-summary {
  area: string,
  collection: string,
  name: string,
}
```

The first working ABI should prove:

1. host passes canonical IR into a capability
2. capability returns artifact data and diagnostics
3. host records capability identity and execution mode
4. artifacts and diagnostics can be compared across Rust and Node hosts

## Echo In-Process Playback

1. Echo receives or locates an authored GraphQL contract family.
2. Echo calls `wesley_core_rs::lower_sdl`.
3. The Rust kernel returns canonical Wesley IR, hashes, and diagnostics.
4. Echo loads an Echo-owned Rust or WASM capability.
5. The capability receives the canonical IR envelope.
6. The capability emits Echo-owned artifacts such as codec inputs, layout
   hashes, ABI descriptors, or IR projections.
7. Echo records the module/capability execution report.
8. No Node process runs in the compiler-critical path.

This is the first reason the Rust kernel exists.

## Node / TypeScript Playback

1. A developer runs `pnpm wesley compile --schema schema.graphql`.
2. The Node host calls the Rust kernel through N-API or WASM.
3. The Rust kernel returns canonical IR and diagnostics.
4. The Node host loads `wesley.config.mjs` and `WESLEY_MODULES` as trusted Node
   code.
5. TypeScript/JavaScript modules are normalized into capability descriptors.
6. If the selected capability is TypeScript, Node executes it.
7. If the selected capability is WASM, Node executes it through the WASM host.
8. The run emits artifacts plus a `ModuleLoadReport` and capability execution
   report.

The current TypeScript module DX survives, but it is no longer confused with
portable compiler truth.

## WASM Capability Playback

1. A module author compiles a capability to WASM.
2. The module declares capability metadata and ABI version.
3. A Rust or Node host loads the WASM component.
4. The host passes a canonical input envelope.
5. The component returns artifacts, diagnostics, and optional evidence entries.
6. The host enforces resource policy such as fuel, time, memory, and allowed
   host functions.
7. The host records the execution mode as `wasm`.

WASM is not magic security. It is a smaller, auditable extension boundary with
explicit host imports.

## Sequential Migration Plan

### Phase 0: Contract Freeze

- define canonical IR fixture corpus
- define canonical JSON byte rules
- identify JS functions that currently own parse/lower/hash truth
- name behavior that is intentionally not in Rust core

### Phase 1: Rust IR Crate

- scaffold `crates/wesley-core`
- port canonical IR structs
- derive serde serialization
- implement canonical serialization fixtures
- do not parse GraphQL yet if that slows the first proof

### Phase 2: Parser And Lowering Parity

- choose parser after a fixture spike, likely `apollo-parser` or
  `async-graphql-parser`
- port directive validation
- port lowering
- compare JS and Rust outputs over canonical fixtures
- record expected divergences as versioned changes, not surprises

### Phase 3: Node Binding

- expose Rust lowering to Node through N-API or WASM
- keep current CLI behavior
- add an environment switch so JS and Rust lowerers can run side by side
- use parity tests before flipping defaults

### Phase 4: WASM Capability ABI

- define the minimal ABI
- implement one fixture WASM capability
- run it from Node and Rust
- record capability execution reports

### Phase 5: Echo In-Process Spike

- consume `wesley-core-rs` from Echo or an Echo-facing fixture harness
- lower a real Echo-owned schema in process
- run an Echo-owned capability without Node
- compare emitted artifacts or hashes against current fixture truth

### Phase 6: Host Cutover

- make Rust lowering the default for Node once parity is proved
- keep JS lowering only as compatibility/fallback if needed
- document migration, diagnostics, and rollback behavior

## Tests To Write First

- fixture test proving canonical IR JSON bytes match between JS and Rust for a
  small SDL corpus
- fixture test proving directive validation errors have stable codes and spans
- property or fuzz test over parser/lowering inputs that compares JS and Rust
  acceptance/rejection classes
- Node binding smoke test for `lower_sdl`
- Rust crate unit test for canonical hash vectors
- WASM capability round-trip test from Rust host
- WASM capability round-trip test from Node host
- ModuleLoadReport test that distinguishes `rust-native`, `wasm`, and
  `typescript-node` execution modes
- Echo harness test proving in-process lowering without shelling to Node

## Linked Invariants

- [Schema Source Of Truth](../../invariants/schema-source-of-truth.md)
- [Evidence Truth](../../invariants/evidence-truth.md)
- [Governance Boundaries](../../invariants/governance-boundaries.md)
- [Local First Operation](../../invariants/local-first-operation.md)
- [Publication Boundary Truth](../../invariants/publication-boundary-truth.md)
- [Witness Scope Honesty](../../invariants/witness-scope-honesty.md)

## Design Invariants

- Rust core must stay domain-empty.
- Rust core must not depend on Node.
- TypeScript modules must remain host adapters, not the portable ABI.
- WASM capabilities must use explicit host imports.
- Capability execution reports must say which engine ran the capability.
- JSON parity is the first migration proof.
- Echo in-process use is a first-class user story, not a side effect.

## Risks / Unknowns

- GraphQL parser choice may expose subtle AST and directive differences.
- Canonical serialization may be harder than the initial Rust struct port.
- N-API is likely best for Node performance, but WASM may be easier to package
  across hosts. Treat this as a binding choice, not a kernel choice.
- WASM component tooling may still be heavier than a first fixture needs.
- TypeScript authors may expect their modules to work everywhere; docs must be
  explicit that TypeScript modules are Node-hosted unless compiled to WASM.
- Rewriting too much too early would stall the module-runtime work that already
  exists.

## Non-Goals

- no immediate rewrite of the CLI
- no immediate removal of JS lowering
- no product or database semantics in Rust core
- no direct TypeScript runtime embedded into Rust core
- no claim that WASM alone is a complete security sandbox
- no Echo runtime ownership inside generic Wesley

## Immediate Next Step

Write a narrow design follow-up for Phase 0:

1. list the canonical JS parse/lower/hash functions
2. choose the fixture corpus
3. define canonical JSON byte rules
4. define the first Rust structs
5. define parity failure reporting

That is the smallest useful next move. Everything else depends on the parity
contract being boring and exact.

## Retrospective

Not started. This packet currently records the architecture and migration
doctrine only.

Follow-on slices to create:

- `SOURCE_wesley-core-rs-ir-contract-and-fixtures`
- `SOURCE_wesley-core-rs-parser-parity`
- `RUNTIME_node-rust-core-binding`
- `RUNTIME_wasm-capability-abi-fixture`
- `RUNTIME_echo-in-process-wesley-harness`
