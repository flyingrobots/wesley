# AUDIT: CODE QUALITY (2026-04-11)

## 0. 🏆 EXECUTIVE REPORT CARD (Strategic Lead View)

|**Metric**|**Score (1-10)**|**Recommendation**|
|---|---|---|
|**Developer Experience (DX)**|8.5|**Best of:** High-signal 'plan' and 'rehearse' diagnostics.|
|**Internal Quality (IQ)**|8.0|**Watch Out For:** Generator-specific boilerplate sprawl.|
|**Overall Recommendation**|**THUMBS UP**|**Justification:** A robust, schema-centric compiler architecture that successfully decouples authored intent from physical emission.|

---

## 1. DX: ERGONOMICS & INTERFACE CLARITY (Advocate View)

- **1.1. Time-to-Value (TTV) Score (1-10):** 8
    - **Answer:** Fast for standard generate/plan tasks. The 'Continuum' lane requires more complex directory setup and dependency on peer repos.
    - **Action Prompt (TTV Improvement):** `Create a 'wesley init-continuum' command that auto-discovers peer repository roots (Echo, git-warp) and sets up the local .wesley-cache directory structure in one call.`

- **1.2. Principle of Least Astonishment (POLA):**
    - **Answer:** `wesley witness` returns success even if some 'auxiliary' targets failed, provided the primary scope is conformant. This can lead to silent generator drift.
    - **Action Prompt (Interface Refactoring):** `Update the 'witness' protocol to include a '--strict' flag that fails the entire command if ANY generated target in the realization manifest lacks a passing witness.`

- **1.3. Error Usability:**
    - **Answer:** Directive validation errors are reported as raw GraphQL parser failures, which can be cryptic for custom systems directives.
    - **Action Prompt (Error Handling Fix):** `Implement a 'DirectiveValidator' that intercepts custom @wesley/@storage/@policy directives and provides human-readable semantic error messages (e.g. 'Invalid storage backend: mongo. Supported: postgres') before the IR lowering stage.`

---

## 2. DX: DOCUMENTATION & EXTENDABILITY (Advocate View)

- **2.1. Documentation Gap:**
    - **Answer:** Detailed guidance on the IR schema and how to write custom transmutation plugins is missing from the Advanced track.
    - **Action Prompt (Documentation Creation):** `Create 'docs/internals/ir-ontology.md' detailing the IR schema, the optimization passes performed by the core pipeline, and how to extend the IR with custom nodes.`

- **2.2. Customization Score (1-10):** 9
    - **Answer:** Exceptionally high. Pluggable generators and host adapters are well-isolated. Weakest point is the manual registration of generators in the CLI.
    - **Action Prompt (Extension Improvement):** `Implement a 'Generator Registry' that supports dynamic plugin loading from 'package.json' peer-dependencies, allowing third-party generators to be used without modifying the wesley-cli source code.`

---

## 3. INTERNAL QUALITY: ARCHITECTURE & MAINTAINABILITY (Architect View)

- **3.1. Technical Debt Hotspot:**
    - **Answer:** `packages/wesley-core/src/pipeline/Transmuter.mjs`. It manages the entire lowering and generation sequence in one large module.
    - **Action Prompt (Debt Reduction):** `Decompose 'Transmuter.mjs' by extracting the 'Lowering' (SDL -> IR) and 'Emission' (IR -> Generator) phases into dedicated 'LoweringEngine' and 'EmissionEngine' classes.`

- **3.2. Abstraction Violation:**
    - **Answer:** Some generators (e.g. `generator-js`) contain hardcoded assumptions about the host filesystem structure.
    - **Action Prompt (SoC Refactoring):** `Refactor generators to operate purely on the IR and return 'VirtualFile' objects, delegating all physical I/O and path resolution to the 'Host' adapter.`

- **3.3. Testability Barrier:**
    - **Answer:** Integration tests for the database lane require a real PostgreSQL instance or complex Docker orchestration.
    - **Action Prompt (Testability Improvement):** `Provide a 'MockDatabaseAdapter' that implements the rehearsal port using an in-memory SQL parser, allowing for 100% logic coverage of migration planning without physical database dependencies.`

---

## 4. INTERNAL QUALITY: RISK & EFFICIENCY (Auditor View)

- **4.1. The Critical Flaw:**
    - **Answer:** Realization drift. If a schema changes but the user forgets to run `wesley compile`, the local workspace will contain stale artifacts that are still valid from a pure type perspective but factually incorrect.
    - **Action Prompt (Risk Mitigation):** `Implement a 'Realization Watcher' or a mandatory 'wesley check' pre-commit hook that verifies the realization manifest's SHA-256 against the authored schema before allowing a commit.`

- **4.2. Efficiency Sink:**
    - **Answer:** Redundant IR lowering. The compiler lowers the full SDL tree on every command, even when only a small leaf has changed.
    - **Action Prompt (Optimization):** `Implement 'Incremental IR Lowering': Cache IR fragments at the type/field level and only re-lower the affected sub-trees based on a schema diff.`

- **4.3. Dependency Health:**
    - **Answer:** Good. Minimal dependency tree for the core.
    - **Action Prompt (Dependency Update):** `Verify 'pnpm-lock.yaml' consistency and ensure all @wesley/* workspace packages are aligned on the latest TypeScript and Deno runtimes.`

---

## 5. STRATEGIC SYNTHESIS & ACTION PLAN (Strategist View)

- **5.1. Combined Health Score (1-10):** 8.2
- **5.2. Strategic Fix:** **Sovereign IR Caching**. Implementing incremental lowering and realization-watchers ensures that the contract bedrock never drifts from implementation reality.
- **5.3. Mitigation Prompt:**
    - **Action Prompt (Strategic Priority):** `Execute RE-030: Implement a 'Realization Integrity' pre-commit hook that fails if the current schema hash does not match the 'sourceHash' in the realization manifest. Simultaneously, refactor the Transmuter to support 'Fragment-Level Caching' to keep the verification loop fast.`
