# AUDIT: READY-TO-SHIP ASSESSMENT (2026-04-11)

## 1. QUALITY & MAINTAINABILITY ASSESSMENT (EXHAUSTIVE)

1.1. **Technical Debt Score (1-10):** 3
    - **Justification:**
        1. **Generator Boilerplate**: High degree of code duplication across different generator packages.
        2. **Manual Target Registration**: The CLI must be updated manually to support new generator/host combinations.
        3. **Ambient Path Assumptions**: Several internal modules rely on relative path resolution that may fail in non-standard monorepo layouts.

1.2. **Readability & Consistency:**
    - **Issue 1:** The `Transmuter` module uses inconsistent naming for the lowering phase (`lower`, `normalize`, `transform`).
    - **Mitigation Prompt 1:** `Standardize the lowering vocabulary in Transmuter.mjs: use 'lower' for SDL -> IR and 'project' for IR -> Generator targets.`
    - **Issue 2:** Error messages from the HOLMES engine lack standard error codes, making automated remediation difficult.
    - **Mitigation Prompt 2:** `Implement a 'WesleyErrorCode' enum and ensure all HOLMES policy failures carry a machine-readable code (e.g. 'ERR_BREAKING_CHANGE') in the witness payload.`
    - **Issue 3:** The TUI dashboard uses ad-hoc state management rather than the formal TEA pattern used in sister projects.
    - **Mitigation Prompt 3:** `Port the Holmes Dashboard to '@flyingrobots/bijou-tui', aligning its architecture with the 'Deterministic State' standard of the monorepo.`

1.3. **Code Quality Violation:**
    - **Violation 1: SRP (`Pipeline.run`)**: It handles ingestion, transmutation, and realization manifest emission in a single large loop.
    - **Violation 2: SoC (`GeneratorPostgres`)**: It manages both the SQL template emission and the physical file writing.
    - **Violation 3: SRP (`WitnessService`)**: It runs the tests AND formats the machine-readable evidence output.

## 2. PRODUCTION READINESS & RISK ASSESSMENT (EXHAUSTIVE)

2.1. **Top 3 Immediate Ship-Stopping Risks (The "Hard No"):**
    - **Risk 1: Realization Drift (High)**: No automated check ensures that generated code is perfectly synchronized with the authored schema before a commit.
    - **Mitigation Prompt 7:** `Implement a 'Realization Guard' in the pre-commit hook that re-runs the compiler in dry-run mode and fails if the resulting IR hash differs from the committed realization manifest.`
    - **Risk 2: SQL Injection in Plans (Medium)**: Maliciously crafted GraphQL directives could theoretically inject unsafe SQL strings into the generated migration plans.
    - **Mitigation Prompt 8:** `Add a 'Directives Sanitization' pass to the Postgres generator that enforces strict quoting and parameterization for all SDL-sourced identifiers.`
    - **Risk 3: OOM on Large Schemas (Low)**: Recursive IR lowering could exceed memory limits for exceptionally deep or wide GraphQL schemas.
    - **Mitigation Prompt 9:** `Refactor the IR lowering phase to use an iterative tree-walking strategy rather than deep recursion, capping the maximum schema depth.`

2.2. **Security Posture:**
    - **Vulnerability 1: Artifact Integrity**: Generated code is committed to Git but not cryptographically sealed at the file level.
    - **Mitigation Prompt 10:** `Update the realization manifest to include per-file HMAC signatures, allowing the 'witness' tool to verify that generated artifacts haven't been modified by human or agent actors.`
    - **Vulnerability 2: Host Path Disclosure**: Error reports in some generators could leak local absolute paths in the JSONL manifests.
    - **Mitigation Prompt 11:** `Implement a 'Path Normalizer' port that strips absolute user-system paths from all manifests and error reports, favoring repo-relative coordinates.`

2.3. **Operational Gaps:**
    - **Gap 1: Conformance Benchmarks**: No CI gate for "Time to Witness" metrics.
    - **Gap 2: Remote Witness Registry**: No standardized way to publish witnesses to a central repository for cross-team verification.
    - **Gap 3: Rollback Strategy**: No automated tool to "un-rehearse" a database change if the evidence shows a regression.

## 3. FINAL RECOMMENDATIONS & NEXT STEP

3.1. **Final Ship Recommendation:** **YES, BUT...** (Implement the Realization Guard and Artifact Signing immediately).

3.2. **Prioritized Action Plan:**
    - **Action 1 (High Urgency):** Implement the Realization Guard to prevent schema-implementation drift.
    - **Action 2 (Medium Urgency):** Standardize the 'witness' error taxonomy.
    - **Action 3 (Low Urgency):** Decompose the Transmuter module into lowering/emission engines.
