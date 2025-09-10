# Wesley Task List (Critical Fixes and Next Steps)

- [x] Create branch `fix/critical-issues`.
- [x] Parser: add directive aliases (`@primaryKey`→`@wes_pk`, `@foreignKey`→`@wes_fk`, keep `@table/@pk/@fk`).
- [x] Parser: accept `@default(value: ...)` or `@default(expr: ...)`.
- [x] Parser: skip relation-only fields (e.g., `@hasMany/@hasOne/@belongsTo` without FK).
- [x] Parser: add scalar mappings (`UUID`, `JSON`, `Date`, `Time`).
- [x] Update example SDLs to use named directive args (`@uid(value: ...)`, `@weight(value: ...)`).
- [x] Sanity E2E: run `blade --dry-run` and produce `.wesley/SHIPME.md`.
- [ ] Wire `@wesley/generator-js` emit wrappers and integrate in host runtime.
- [ ] Re-enable CLI commands and tests for models/typescript/zod.
- [ ] Reduce directive validation noise (tune or extend validator schema).
- [ ] Align README/docs/examples to canonical `@wes_*` directives (or clearly document aliases).
- [x] Deprecate legacy demo app assets (archive or remove outdated example/stack files).
- [ ] Extract shared plan utilities (dedupe between `plan.mjs` and `rehearse.mjs`).
- [ ] CI: add a simple E2E step (generate on example + blade dry-run) to `pnpm ci`.
- [ ] Verify and finalize package exports across workspaces.
- [ ] Optionally gate or silence `@wesley/tasks`/`@wesley/slaps` missing warnings.


## Appendix

1) Create branch `fix/critical-issues`
- What: Create a working branch to land critical fixes safely.
- Where: Git branch at repository root.
- Why: Isolate changes and enable iterative E2E testing without blocking main.
- Priority: P0
- Rationale: Foundation for all subsequent fixes; enables quick, contained merges.

2) Parser: directive aliases (PK/FK/Index)
- What: Support `@primaryKey/@foreignKey/@index` and short forms as aliases to canonical `@wes_*`.
- Where: `packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs`
- Why: Existing examples and user schemas use these forms; without aliases parsing fails or misses semantics.
- Priority: P0
- Rationale: Unblocks generate/plan by recognizing core constraints consistently.

3) Parser: accept default value or expr
- What: Allow `@default(value: ...)` or `@default(expr: ...)` to set column defaults.
- Where: `packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs`
- Why: Examples and prior docs use both names; strict `value` caused errors.
- Priority: P0
- Rationale: Reduces friction and harmonizes with existing schemas.

4) Parser: skip relation-only fields
- What: Do not emit columns for relation-only fields (object types with `@hasMany/@hasOne/@belongsTo` and no FK).
- Where: `packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs`
- Why: Prevents bogus text columns for navigation properties.
- Priority: P0
- Rationale: Keeps IR → DDL clean and accurate.

5) Parser: scalar mappings (UUID/JSON/Date/Time)
- What: Map `UUID→uuid`, `JSON→jsonb`, `Date→date`, `Time→time with time zone`.
- Where: `packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs`
- Why: Common scalar types used in examples; improves default generation.
- Priority: P0
- Rationale: Avoids fallback to `text` and improves generated DDL quality.

6) Update example SDLs to named args
- What: Change positional directive args to named (`@uid(value: ...)`, `@weight(value: ...)`).
- Where: `example/schema.graphql`, `example/ecommerce.graphql`
- Why: GraphQL SDL requires named args; positional caused parse failures.
- Priority: P0
- Rationale: Restores working examples and demos.

7) Sanity E2E: blade dry-run writes SHIPME
- What: Run `blade --dry-run` to exercise transform → plan → rehearse (dry) → cert pipeline.
- Where: CLI entry `packages/wesley-host-node/bin/wesley.mjs`; artifacts in `.wesley/SHIPME.md`.
- Why: End-to-end verification that a minimal schema flows through.
- Priority: P0
- Rationale: Confidence check; re-establishes working demo path.

8) Wire `@wesley/generator-js` emit wrappers and integrate
- What: Provide `emitModels/emitZod/emitNextApi` functions in `@wesley/generator-js` or adapt host to class APIs; connect in `createNodeRuntime`.
- Where: `packages/wesley-generator-js/src` (add emit wrappers), `packages/wesley-host-node/src/adapters/createNodeRuntime.mjs`.
- Why: Restore models/types/zod generation in the unified pipeline.
- Priority: P1
- Rationale: Completes “GraphQL → Everything” beyond SQL/tests; unblocks related CLI/tests.

9) Re-enable CLI commands and tests (models/typescript/zod)
- What: Import/register these commands in `program.mjs`; update or add tests accordingly.
- Where: `packages/wesley-cli/src/program.mjs`, `packages/wesley-cli/src/commands/*.mjs`, tests under `packages/wesley-cli/test/` and/or `test/`.
- Why: Ensure parity with prior CLI and E2E coverage.
- Priority: P1
- Rationale: Users expect these generators; strengthens CI signal.

10) Reduce directive validation noise
- What: Extend directive schema or relax validator to avoid noisy warnings (e.g., root type presence, unknown meta directives like `@uid/@weight`).
- Where: `packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs`, `schemas/directives.graphql`.
- Why: Cleaner UX during normal runs; fewer confusing warnings.
- Priority: P1
- Rationale: Improves developer experience without sacrificing safety.

11) Align README/docs/examples to canonical `@wes_*` (or document aliases)
- What: Update snippets to use `@wes_*` or clearly state supported aliases and recommendations.
- Where: `README.md`, `docs/*`, `example/*.graphql`, `demo/blade/*.graphql`.
- Why: Reduce mismatch between docs, examples, and parser behavior.
- Priority: P1
- Rationale: Prevents future drift and onboarding friction.

12) Extract shared plan utilities
- What: Deduplicate plan/explain/emit helpers used in both `plan.mjs` and `rehearse.mjs` into a shared module.
- Where: `packages/wesley-cli/src/commands/plan.mjs`, `packages/wesley-cli/src/commands/rehearse.mjs`, new shared helper file.
- Why: Single source for planning logic; easier maintenance and testing.
- Priority: P2
- Rationale: Reduces inconsistencies and code duplication.

13) CI: add E2E step
- What: Add simple CI steps: `wesley generate --schema example/schema.graphql` and `wesley blade --schema <min> --dry-run` in `pnpm ci`.
- Where: root `package.json` scripts and/or CI workflow.
- Why: Guardrail to keep the green path working.
- Priority: P1
- Rationale: Early detection of regressions in core pipeline.

14) Verify and finalize package exports
- What: Audit `exports`/`main` across workspaces to ensure consumers and CLI resolve correctly.
- Where: `packages/*/package.json` (notably `@wesley/host-node`, `@wesley/cli`, generators).
- Why: Prevent resolution/runtime issues and enable external consumption.
- Priority: P2
- Rationale: Solidifies packaging before broader adoption.

15) Optionally gate/silence missing TASKS/SLAPS warnings
- What: Tweak host runtime to only warn in verbose mode or behind a flag if `@wesley/tasks`/`@wesley/slaps` are absent.
- Where: `packages/wesley-host-node/src/adapters/createNodeRuntime.mjs`.
- Why: Reduce noise for users not using orchestration yet.
  - Priority: P3
  - Rationale: Cosmetic improvement; defer if bandwidth is tight.

16) Deprecate legacy demo app assets
- What: Remove outdated demo artifacts from the original app to reduce noise.
- Where: Removed files include: `example/demo.sh`, `example/DEMO_SCRIPT.md`, `example/generated-*.sql`, `example/seed.sql`, `example/failing-to-passing.sql`, `example/tests/generated.sql`, `example/docs/WalkThru.md`, `example/edge/**`, `example/ui/**`, `example/supabase/**`, `example/db/**`, `example/out/schema.sql`, `example/.wesley/*`, `example/ux-design.md`, `example/tech-spec.md`, `example/seo-graph-ql-*`, `example/env.example`; also removed `packages/wesley-stack-supabase-nextjs/**`.
- Why: We pivoted to the BLADE demo; legacy assets confused tests and users.
- Priority: P1
- Rationale: Keeps the repo focused. Git history preserves the old demo if needed.
