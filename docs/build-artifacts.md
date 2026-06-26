# Build Artifacts Reference

Wesley generates several directories and files as part of its compile and validation workflows. These artifacts are ignored by Git so they can be safely regenerated, but it helps to know what they contain before cleaning them up.

| Artifact                                | Produced By                                                              | Purpose / Contents                                                                                                                                                              | Safe to Delete?                                |
| --------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `.wesley-cache/`                        | Wesley evidence fixtures and HOLMES/Moriarty analysis by default         | Default generated evidence bundle location for Wesley-owned workflows: score reports, SHIPME certificate inputs, HOLMES inputs, ledger state, and counterfactual cache. External targets may choose their own cache paths. | ✅ Generated each run.                         |
| `out/`                                  | Native emit commands by default; external targets only when configured   | Default generic output location for explicit CLI commands such as `wesley emit rust` / `wesley emit typescript`. External target modules own any additional `out/` layout they choose to emit. | ✅ Generated from the current schema.          |
| `out/zod/`                              | External target modules, if configured                                   | JavaScript validation schemas are no longer a core Wesley command; this path appears only when an owning external target elects to emit it.                                     | ✅ Regenerated when commands run.              |
| `test/fixtures/examples/out/`           | `pnpm generate:example`, direct CLI runs using the bundled fixtures      | Generated artifacts for the ecommerce demo schema (follows the same subdirectory layout).                                                                                       | ✅ Regenerated on next demo run.               |
| `test/fixtures/examples/.wesley-cache/` | `pnpm generate:example`, demo rehearsals                                 | Evidence bundle for example schema; mirrors root `.wesley-cache/`.                                                                                                              | ✅ Regenerated with demo commands.             |
| `coverage/`                             | `pnpm test:coverage`                                                     | Coverage reports from Jest/Vitest suites.                                                                                                                                       | ✅ Pure test output.                           |
| `dist/`                                 | Package-level build scripts (`pnpm -r build`)                            | Transpiled bundles for any package that emits compiled JS.                                                                                                                      | ✅ Rebuilt by the corresponding package build. |

> ℹ️ Additional temporary directories may appear under individual packages when running bespoke scripts. They follow the same pattern—anything listed in `.gitignore` is expected to be disposable unless you are auditing the output.

## Cleaning Up

The repository defines `pnpm clean` to remove the directories above in one shot. Use it whenever you want to return the workspace to a pristine state before a fresh compile or demo run. See `scripts/clean.mjs` for the exact list of paths.

Visible Holmes configuration lives in checked-in root files such as `wesley.holmes-policy.json` and `wesley.weights.json`. Generated runtime state belongs under `.wesley-cache/`; it should stay gitignored.
