# Generate execution orchestration split

- Lane: `bad-code`
- Legend: `RUNTIME`

## Why now

`packages/wesley-cli/src/commands/generate-execution.mjs` is the release
branch's largest CLI orchestration hotspot. It coordinates preconditions, IR
cache resolution, unit filtering, event emission, transmutation execution,
artifact writing, snapshot persistence, evidence enrichment, history merging,
git SHA lookup, dirty-worktree policy, and failure attachment in one file.

## Hill

`runSequentialGeneration` stays as the command-facing facade, while source/git
policy, transmutation execution, and evidence/history persistence each become
small, testable modules.

## Done looks like

- source/git policy checks are extracted behind focused helpers
- transmutation execution and git SHA resolution are extracted and unit-tested
- evidence bundle, score, and history persistence are extracted and
  unit-tested
- emitted event shapes and command return shapes remain backward compatible
- regression coverage includes `--emit-bundle`, `--dry-run`, `--print-ir`,
  `--resume`, and dirty-worktree enforcement

## Repo Evidence

- `packages/wesley-cli/src/commands/generate-execution.mjs`
- `packages/wesley-cli/src/utils/runtime-events.mjs`
- `packages/wesley-cli/src/utils/schema-ir-cache.mjs`
- `docs/audit/2026-05-05_code-quality.md`
- `docs/audit/2026-05-05_ship-readiness.md`
