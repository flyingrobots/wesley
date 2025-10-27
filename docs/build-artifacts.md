# Build Artifacts Reference

Wesley generates several directories and files as part of its compile and validation workflows. These artifacts are ignored by Git so they can be safely regenerated, but it helps to know what they contain before cleaning them up.

| Artifact | Produced By | Purpose / Contents | Safe to Delete? |
| --- | --- | --- | --- |
| `.wesley/` | `wesley generate`, `wesley plan`, `wesley rehearse`, `wesley cert-*` | Evidence bundle, score reports, SHIPME certificate, HOLMES inputs. Delete when you no longer need the latest bundle. | ✅ Generated each run. |
| `out/` | `wesley generate` | Core DDL (`schema.sql`), RLS output (`rls.sql`), and default artifacts. | ✅ Generated from the current schema. |
| `out/tests/` | `wesley generate` | pgTAP suites (`tests.sql`) and future test artifacts. | ✅ Regenerated on compile. |
| `out/models/`, `out/zod/` | (future) `wesley models/zod` commands | JavaScript/TypeScript models and validation schemas. | ✅ Regenerated when commands run. |
| `out/ops/` | `wesley generate --ops …` | Experimental operation SQL (views/functions), an operation registry (`registry.json` v1.0.0), and optional EXPLAIN snapshots (`explain/*.explain.json`). | ✅ Regenerated when ops compile. |
| `test/fixtures/examples/out/` | `pnpm generate:example`, direct CLI runs using the bundled fixtures | Generated artifacts for the ecommerce demo schema (follows the same subdirectory layout). | ✅ Regenerated on next demo run. |
| `test/fixtures/examples/.wesley/` | `pnpm generate:example`, demo rehearsals | Evidence bundle for example schema; mirrors root `.wesley/`. | ✅ Regenerated with demo commands. |
| `test/fixtures/blade/*.key`, `test/fixtures/blade/*.pub`, `test/fixtures/blade/keys/` | `test/fixtures/blade/run.sh` | Temporary signing keys for the BLADE demo flow. | ✅ Regenerate as part of the demo. |
| `coverage/` | `pnpm test:coverage` | Coverage reports from Jest/Vitest suites. | ✅ Pure test output. |
| `dist/` | Package-level build scripts (`pnpm -r build`) | Transpiled bundles for any package that emits compiled JS. | ✅ Rebuilt by the corresponding package build. |
| `tests/generated/` | CLI/evidence workflows | Generated SQL/pgTAP test suites used during rehearsal. | ✅ Regenerated on next CLI run. |

> ℹ️ Additional temporary directories may appear under individual packages when running bespoke scripts. They follow the same pattern—anything listed in `.gitignore` is expected to be disposable unless you are auditing the output.

## Cleaning Up

The repository defines `pnpm clean` to remove the directories above in one shot. Use it whenever you want to return the workspace to a pristine state before a fresh compile or demo run. See `scripts/clean.mjs` for the exact list of paths.

Output locations are driven by `wesley.config.mjs` (`paths.output` + `paths.artifacts`). Override those values to redirect generators without editing the commands themselves.
