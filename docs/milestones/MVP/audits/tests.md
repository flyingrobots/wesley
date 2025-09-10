# Test Suite Audit Report — MVP

## 1. Executive Summary

The "wesley" project has a strong foundation of high-quality unit tests that inspire confidence in the core domain logic. The test quality at this level is excellent.

However, the project currently suffers from a critical gap in **end-to-end (E2E) testing**. The most important user workflows—`plan`, `rehearse`, and `certify`—are not covered. This means the primary value proposition of safe, zero-downtime migrations is not being automatically verified. While the unit tests validate the building blocks, the absence of E2E tests means we are not testing the complete, assembled product.

**Recommendation:** The highest priority is to implement a comprehensive E2E test suite that validates the entire `transform` → `plan` → `rehearse` → `certify` workflow against a real database.

## 2. Test Inventory & Analysis

### 2.1. Unit Tests (`@wesley/core`)

*   **Quality:** Excellent.
*   **Coverage:** Comprehensive for the components they target.
*   **Analysis:**
    *   `ddl-planner.test.mjs`: This is a high-quality test file that covers a wide range of DDL operations and their expected lock levels. It tests sorting, conflict detection, and risk calculation.
    *   `safety-validator.test.mjs`: Another excellent, comprehensive test file. It covers concurrent operation checks, resource limits, permissions, and dependency validation. The use of custom error types and event emission is also well-tested.
*   **Gaps:**
    *   There is an opportunity to expand **property-based testing**, especially for the DDL planner and migration differ, to catch more complex and unexpected edge cases.

### 2.2. Integration Tests

*   **Quality:** Good.
*   **Coverage:** Decent for individual generator outputs.
*   **Analysis:**
    *   The snapshot tests in `packages/wesley-core/test/snapshots` do a good job of ensuring the output of the generators remains consistent.
*   **Gaps:**
    *   There is a lack of integration tests that verify the flow of data *between* major components (e.g., from the parser's IR to the DDL planner).

### 2.3. E2E Tests (`.bats` files)

*   **Quality:** Good for what they cover. The tests are well-structured and use best practices for shell testing.
*   **Coverage:** Poor. Only the "happy path" of the `generate`, `models`, `zod`, and `typescript` commands are covered.
*   **Gaps (CRITICAL):**
    *   **No `plan`, `rehearse`, `certify` Tests:** There are no E2E tests for the most critical workflows.
    *   **No Database Interaction:** The E2E tests do not interact with a database. They only verify that files are created.
    *   **No pgTAP Validation:** The generated pgTAP tests are never executed.

## 3. Comparison with `TestPlan.md`

| Test Plan Requirement                                       | Status                               | Gaps                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Unit Tests** (IR mapping, directive validation)           | ✅ **Implemented**                     | Minor gaps, but overall very strong.                                                                                              |
| **Integration Tests** (DDL generator, diff planner, pgTAP)  | ⚠️ **Partially Implemented**           | Snapshot tests exist, but a key missing piece is testing the `diff planner`'s output.                                               |
| **E2E Tests** (transform → plan → rehearse → certify)        | ❌ **Not Implemented**                 | This is the most significant gap. The full workflow is not tested.                                                                |
| **CI Automation** (run full workflow)                       | ❌ **Not Implemented**                 | The CI job cannot be fully implemented without the E2E tests.                                                                     |
| **Security Tests** (no secrets in evidence, tamper-proof)   | ❌ **Not Implemented**                 | There are no tests to verify that secrets are not accidentally included in the `SHIPME.md` or that signatures are being validated. |
| **Risk-Based Tests** (backfill idempotence, lock patterns) | ⚠️ **Partially Implemented** (at unit level) | The unit tests for the DDL planner cover lock patterns, but backfill idempotence is not tested in a real database scenario.        |

## 4. Recommendations

1.  **High Priority: E2E Test Suite for Core Workflow**
    *   Create a new `.bats` test file (e.g., `workflow-e2e.bats`) that executes the full `transform` → `plan` → `rehearse` → `certify` flow.
    *   This test should use a real PostgreSQL database (e.g., via Docker) to apply the migration and run the pgTAP tests.
    *   Assert that the `rehearse` command succeeds and that the `certify` command produces a valid `SHIPME.md` file.

2.  **Medium Priority: Expand Integration Testing**
    *   Add tests that cover the interaction between the parser, planner, and generators to ensure they work together as expected.

3.  **Low Priority: Expand Property-Based Testing**
    *   Invest in more property-based tests for the `DDLPlanner` and `MigrationDiffer` to catch complex edge cases and improve the overall robustness of the system.

