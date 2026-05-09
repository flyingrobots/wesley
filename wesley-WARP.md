# Wesley-WARP: The Causal OS Roadmap

This document outlines the multi-phase transition of Wesley from a legacy "static compiler" to a conforming **Cold WARP Runtime** and **Optic Architect** for the Continuum.

---

## Phase 1: The Cold Kernel (Foundation)

**Objective:** Establish `wesley-core` as a conforming WARP runtime library that produces the first level of semantic truth.

### P1.001: Universal WarpOptic Primitives
- Implement the `WarpOptic` trait and `OpticBuilder` fluent API in Rust.
- Connect the kernel to the `warp-core` physics engine from Echo.

### P1.002: Semantic Consolidation (L1 Projection)
- Implement "Holographic Type Merging" (merging `extend type` and base definitions).
- Ensure the internal graph representation is atomic and consolidated before any reading is projected.

### P1.003: Cross-Host L1 Parity
- Achieve byte-level parity with the legacy JS implementation for small, medium, and large (100+ type) schemas.
- Use lexicographical sorting and declaration-order preservation to ensure identical hashes across Rust and JS.

### P1.004: Domain-Empty Validation
- Refactor all Postgres-specific logic out of the core and into a generic `DirectiveRegistry`.
- Ensure the kernel only emits the pure `schemas/ir.schema.json` contract.

**End of Phase 1 Deliverables:**
- A robust Rust library (`wesley-core`) that can project a **Level 1 Semantic Reading** from any causal coordinate.
- Mathematically proven parity with today's "Truth Anchor."

---

## Phase 2: The Honesty Auditor (Footprint Extraction)

**Objective:** Enforce the "No-Graph" law by statically and dynamically proving the geometric boundaries of every intent.

### P2.001: Static Footprint Extraction
- Parse GraphQL Operations (Query/Mutation) and extract the **Footprint Template** (the selection set).
- Map selection sets to `warp_core::footprint::Footprint` structures.

### P2.002: Dynamic Binding Primitives
- Implement `bindFromArg` and `bindFromSlot` logic to resolve specific node instances at admission time.
- Support "Slot Chaining" to represent deep causal dependencies in the graph.

### P2.003: The Honesty Guard
- Build the adjudication logic that compares a proposed `TickDelta` (graph rewrite) against its bound footprint.
- Reject any intent that attempts to read/write/delete nodes outside its declared aperture.

**End of Phase 2 Deliverables:**
- The ability to detect and prevent **Dishonest Footprints** before they can contaminate a worldline.
- A "Footprint-Honest" GraphQL-to-DPO compiler.

---

## Phase 3: The Target Projection Layer (L2 & L3)

**Objective:** Enable specialized domain readings and cryptographic provenance.

### P3.001: Decoupled L2 Adapters
- Implement `wesley-postgres` and `wesley-echo` as external L2 transmuters.
- They consume the clean L1 IR and project it into target-specific models (L2 IR).

### P3.002: The DPO Rewrite Engine
- Replace procedural "lowering" with a formal **Double-Pushout (DPO)** graph-rewriting engine.
- Every transformation step must be recorded as a **Causal Trace**.

### P3.003: Level 3 IR (The Hologram)
- Implement the "Witnessed Materialization" layer.
- Every artifact produced by Wesley now carries its full DPO trace as a **Holographic Witness**.

### P3.004: Wesley-Holmes Rust Port
- Implement the "Forensic Optic" in Rust to verify L3 witnesses across the Continuum.

**End of Phase 3 Deliverables:**
- A complete "Truth Chain" from GraphQL Intent to materialized Artifact.
- Cryptographically verifiable provenance for all compiler outputs.

---

## Phase 4: The Bridge (Echo & CLI)

**Objective:** Unify the "Hot" and "Cold" worlds.

### P4.001: Echo-Library Integration
- Integrate `wesley-core` as a library dependency in Echo.
- Echo ticks now use Wesley to construct Optics on-demand for schema-aware state transitions.

### P4.002: NAPI-RS Bindings
- Provide high-performance Node.js bindings for the Rust kernel.
- Replace the legacy JS `GraphQLAdapter` with the native Rust engine.

### P4.003: The Parity Sentinel
- Automated CI check that ensures the Rust and JS implementations never diverge.

---

## Phase 5: The Causal OS (Ubiquity)

**Objective:** The standalone native environment and agentic habitat.

### P5.001: `wes-native` Standalone Binary
- Statically compiled CLI that requires zero Node.js runtime.
- Built-in `wasmtime` engine to host portable transmuters.

### P5.002: Wesley MCP Server
- Expose the core as an **Interactive Assurance Oracle** for AI agents (Claude, Gemini, etc.).

### P5.003: WARPDrive (FUSE Aperture)
- Materialize holographic "files" for legacy tools, transforming the file system into a reading surface for the Continuum.

**HOO RAH!** 🚀📐⚖️💎🧬🔥✨🦾🛑🌌🐚🔚🛸
