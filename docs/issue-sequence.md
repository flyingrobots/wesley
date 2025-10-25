# Wesley Development Roadmap: Key Strategic Issues

This document outlines a recommended sequence for tackling critical strategic issues, prioritizing foundational safety and core functionality before enhancing developer experience.

## Why this sequence?

This sequence is designed to build Wesley's capabilities incrementally, ensuring that each major feature is built upon a solid foundation of testing and safety. The rationale is as follows:

1.  **Establish a Safety Net:** The E2E test suite is paramount. It provides the confidence needed to develop complex and potentially risky features like destructive migrations without fear of regressions.
2.  **Unlock Core Functionality:** Destructive migrations are a fundamental requirement for any production-grade schema management tool. This is the biggest missing piece for Wesley to manage a full application lifecycle.
3.  **Enhance Safety & DX for Core Features:** The interactive CLI is a direct dependency and companion to destructive migrations, ensuring that risky operations are explicitly confirmed by the user.
4.  **Improve Developer Experience (Parallel Track):** IDE integration and visualization, while highly valuable, can be developed somewhat independently once the core functionality and safety mechanisms are in place.

## Strategic Issue Sequence Checklist

This checklist sequences the issues in a recommended order of implementation.

### Phase 1: Foundational Safety & Confidence

-   [ ] **#188: E2E Test Suite for Core Workflow**
  - **Priority:** 5/5
  - **Rationale:** Provides the essential safety net for all future development. Moves Wesley to a beta-ready state.

### Phase 2: Core Schema Management & Safety

-   [ ] **#189: Feature: Destructive Migration Planning**
  - **Priority:** 5/5
  - **Rationale:** Unlocks the ability to manage full schema evolution, including breaking changes, which is critical for production use.

### Phase 3: Enhanced Developer Experience & Risk Mitigation

-   [ ] **#190: DX: Interactive CLI for Risky Operations**
  - **Priority:** 4/5
  - **Rationale:** A direct dependency of destructive migrations, ensuring user confirmation for high-risk operations. Improves safety and DX.

### Phase 4: Ecosystem Integration & Visualization

-   [ ] **#191: DX: IDE Integration and Schema Visualization**
    *   **Priority:** 3/5
    *   **Rationale:** Improves developer productivity and onboarding. Can be developed in parallel with other phases once core features are stable.

## MECE Paths Through the Dependency Graph

To facilitate parallel development and clear workstreams, the issues can be grouped into the following Mutually Exclusive, Collectively Exhaustive (MECE) paths:

### Path A: Core Safety & Migration Lifecycle (Sequential)

This path focuses on building the essential safety mechanisms and core migration capabilities. Issues in this path are largely sequential due to strong dependencies.

1.  **#188: E2E Test Suite for Core Workflow**
2.  **#189: Feature: Destructive Migration Planning**
3.  **#190: DX: Interactive CLI for Risky Operations**

### Path B: Developer Experience & Ecosystem Integration (Parallel)

This path focuses on improving the developer's interaction with Wesley and integrating it into the broader development ecosystem. This work can largely proceed in parallel with Path A, especially after #188 is complete.

1.  **#191: DX: IDE Integration and Schema Visualization**

These paths ensure that critical foundational work is completed first, while allowing for parallel development of important developer experience enhancements.
