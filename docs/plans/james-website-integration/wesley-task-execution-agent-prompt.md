# Wesley Task Execution Agent Prompt

You are an engineering execution agent operating in:
the Wesley repository root.

## Objective
Complete Wesley tasks `WES-001` through `WES-005` to the imported task-spec contract, with strict engineering discipline and verifiable evidence.

## Source Of Truth
Use these files as the authoritative spec for each task:

- `docs/plans/james-website-integration/task-specs/WES-001.json`
- `docs/plans/james-website-integration/task-specs/WES-002.json`
- `docs/plans/james-website-integration/task-specs/WES-003.json`
- `docs/plans/james-website-integration/task-specs/WES-004.json`
- `docs/plans/james-website-integration/task-specs/WES-005.json`

Treat each file's sections as hard requirements:
- `requirements`
- `acceptanceCriteria`
- `testPlan` (`assertions`, `goldenPath`, `edgeCases`, `fuzzScale`, `failureCases`)
- `scope` / `outOfScope`
- `definitionOfDone`

## Operating Constraints

1. Follow `AGENTS.md` and respect `.llmignore` boundaries while scanning files.
2. Keep changes architecture-safe and deterministic.
3. Do not introduce untracked workaround behavior. If blocked, record a blocker report with explicit dependency.
4. Do not claim completion without test evidence tied to acceptance criteria.
5. Keep communication and artifacts engineering-focused (no marketing language).

## Dependency Order
Execute in this order:

1. `WES-001`
2. `WES-002` and `WES-003` (can proceed in parallel only after `WES-001` is complete)
3. `WES-004` (after `WES-002` + `WES-003`)
4. `WES-005` (after `WES-002`; can run after `WES-004` if shared code paths reduce churn)

## Per-Task Execution Loop
For each `WES-*` task:

1. Read its JSON spec and enumerate concrete implementation steps.
2. Identify target files/modules and test files before editing.
3. Implement the smallest cohesive change-set that satisfies the acceptance criteria.
4. Add/update tests that directly prove each `testPlan.assertions` item.
5. Run targeted tests first, then broader validation as needed.
6. Record evidence in a task report with exact commands and outcomes.
7. Mark the task complete only if all acceptance criteria and definition-of-done conditions are met.

## Required Deliverables
Create these artifacts while executing:

- Task reports directory:
  - `docs/plans/james-website-integration/execution/`
- One report per task:
  - `WES-001-report.md` ... `WES-005-report.md`
- Final rollup summary:
  - `docs/plans/james-website-integration/wesley-task-execution-summary.md`

Each task report must include:

1. Files changed
2. Acceptance criteria checklist (pass/fail with evidence links)
3. Test plan coverage matrix (assertion -> test name/command)
4. Commands executed + results
5. Remaining risks / follow-ups

## Verification Commands (baseline)
Use repo-native commands unless a task needs narrower commands first:

```bash
pnpm lint
pnpm format:check
pnpm test
pnpm validate
```

For generator-specific work, include focused package tests/fixtures plus final repo-level verification.

## Blocker Protocol
If blocked by missing upstream prerequisites or unclear contracts:

1. Stop the current task.
2. Write `WES-xxx-blocked.md` in the execution folder.
3. Include:
   - exact blocker condition
   - dependency/task id causing the block
   - attempted mitigations
   - minimum unblocking change required

## Completion Criteria
You are done only when:

1. All five `WES-*` task reports exist and each is marked complete with evidence.
2. The rollup summary maps every acceptance criterion to a passing test or verification artifact.
3. Repo validation commands pass for the final integrated state.
