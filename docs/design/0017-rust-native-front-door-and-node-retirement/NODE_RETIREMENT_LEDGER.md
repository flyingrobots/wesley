# Node Retirement Ledger

This ledger is the active inventory for retiring the historical Node Wesley
surface. `docs/LEGACY_NODE_MIGRATION.md` remains the public migration summary;
this packet ledger is the working control surface for the 96-slice campaign.
The machine-readable CI/review export lives beside this document as
[`node-retirement-ledger.json`](./node-retirement-ledger.json).
The row-by-row retirement gate summary lives in
[`LEGACY_COMPATIBILITY_MATRIX.md`](./LEGACY_COMPATIBILITY_MATRIX.md).
The leaf-package deletion audit lives in
[`LEAF_PACKAGE_DELETION_AUDIT.md`](./LEAF_PACKAGE_DELETION_AUDIT.md).

## Dispositions

| Disposition | Meaning                                                                |
| ----------- | ---------------------------------------------------------------------- |
| Port        | Rebuild useful behavior in Rust.                                       |
| Extract     | Move useful behavior to an owning repo, module, or package family.     |
| Delete      | Remove after dependents and evidence no longer need it.                |
| Defer       | Keep temporarily because the replacement boundary is not designed yet. |

## Package Inventory

| Surface                         | Current role                                                                                                | Disposition                    | Retirement gate                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/wesley-core/`         | Historical JS compiler domain, generation pipeline, schema utilities, runtime helpers.                      | Port then delete               | Rust core owns compiler facts, emitters own generic projections, and any remaining product/domain behavior is rejected or extracted. |
| `packages/wesley-cli/`          | Historical command framework for generate, transform, TypeScript, Zod, diff, cert, and Holmes-era commands. | Delete after command migration | Every useful command is ported, extracted, or rejected; docs no longer present `pnpm wesley` as product front door.                  |
| `packages/wesley-host-node/`    | Node executable wrapper and runtime adapter.                                                                | Delete                         | Tests and docs use native CLI except explicitly named legacy compatibility lanes.                                                    |
| `packages/wesley-runtime-node/` | Node module loading, counterfactual surface, runtime store helpers.                                         | Extract or delete              | Module/runtime evidence moves to Rust protocol, assurance tooling, or owning modules.                                                |
| `packages/wesley-generator-js/` | Legacy TypeScript/Zod projection surface.                                                                   | Port TypeScript, extract Zod   | Rust emitters cover retained generic output; Zod moves to an external target boundary if still needed.                               |
| `packages/wesley-holmes/`       | Holmes/Moriarty evidence and counterfactual tooling.                                                        | Extract or rebuild later       | Assurance tooling has an explicit package/repo boundary separate from compiler authority.                                            |
| `packages/wesley-host-browser/` | Browser-host experiment.                                                                                    | Delete or externalize          | Browser compatibility stays in a legacy compatibility lane until externalized or deleted.                                            |
| `packages/wesley-host-bun/`     | Bun-host experiment.                                                                                        | Delete or externalize          | Bun compatibility stays in a legacy compatibility lane until obsolete, externalized, or deleted.                                     |
| `packages/wesley-host-deno/`    | Deno-host experiment.                                                                                       | Delete or externalize          | Deno compatibility stays in a legacy compatibility lane until obsolete, externalized, or deleted.                                    |

## Current Deletion Blockers

| Slice  | Surface                         | Why the gate is still open                                                                     |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| NR-076 | `packages/wesley-core/`         | Holmes, host compatibility packages, JS generator, and scripts still import it.                |
| NR-077 | `packages/wesley-cli/`          | Legacy assurance/runtime commands and Bats compatibility suites still execute through it.      |
| NR-078 | `packages/wesley-host-node/`    | Compatibility workflows, root scripts, and legacy CLI smoke tests still reference the wrapper. |
| NR-079 | `packages/wesley-runtime-node/` | Holmes/runtime evidence and parser/parity migration scripts still use it.                      |
| NR-080 | `packages/wesley-generator-js/` | Legacy CLI Zod/models/TypeScript compatibility commands still use it.                          |

## Retired Package Inventory

| Surface                                 | Slice  | Outcome | Replacement / owner                                                                                     |
| --------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------- |
| `packages/wesley-generator-vue/`        | NR-081 | Deleted | Vue projection ownership exits generic Wesley; reintroduce it only through an external target owner.    |
| `packages/wesley-scaffold-multitenant/` | NR-082 | Deleted | Product scaffolding exits generic Wesley; future scaffolds belong to an owning product repository.      |
| `packages/wesley-test-fixtures/`        | NR-083 | Deleted | Useful fixtures live as plain `test/fixtures` assets or Rust tests, not as a workspace package.         |
| `packages/wesley-tasks/`                | NR-084 | Deleted | Rust `TransmutationRunner` keeps descriptor-only task graph evidence without a JavaScript task runtime. |

## Command Inventory

| Legacy command        | Current file                                           | Disposition                         | Rust or external exit                                                                                                      |
| --------------------- | ------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `generate`            | `packages/wesley-cli/src/commands/generate.mjs`        | Port generic pieces, then delete    | Native `emit` commands and external modules replace useful outputs; do not preserve the umbrella command as a core noun.   |
| `transform`           | `packages/wesley-cli/src/commands/transform.mjs`       | Delete                              | Compatibility wrapper around generation; do not recreate as a core noun by default.                                        |
| `compile`             | `packages/wesley-cli/src/commands/compile.mjs`         | Defer, then rebuild                 | Replace Node module dispatch with Rust registry or external-process target protocol.                                       |
| `typescript` / `ts`   | `packages/wesley-cli/src/commands/typescript.mjs`      | Partially ported                    | `wesley emit typescript` owns retained generic TypeScript output.                                                          |
| `zod`                 | `packages/wesley-cli/src/commands/zod.mjs`             | Extract                             | Zod is JavaScript validation output; keep it outside core Wesley unless an external target module owns it.                 |
| `models`              | `packages/wesley-cli/src/commands/models.mjs`          | Retire from core                    | Model-class scaffolding is not compiler truth; retained generic model facts live in Rust and TypeScript emitters.          |
| `diff`                | `packages/wesley-cli/src/commands/diff.mjs`            | Ported for L1 structure             | `wesley schema diff` owns generic schema diff; operation-argument deltas remain separate.                                  |
| `init`                | `packages/wesley-cli/src/commands/init.mjs`            | Retire legacy scaffolding           | Future native `init` may only create tiny generic starter schemas and must be designed as new work, not as a Node port.    |
| `doctor`              | `packages/wesley-cli/src/commands/doctor.mjs`          | Narrow port complete                | `wesley doctor` runs Rust-native health checks only; legacy Node config, plugin, and package diagnostics stay legacy-only. |
| `validate-bundle`     | `packages/wesley-cli/src/commands/validate-bundle.mjs` | Assurance boundary                  | Keep compatibility-only until evidence bundle validation moves beside assurance tooling.                                   |
| `runs`                | `packages/wesley-cli/src/commands/runs.mjs`            | Assurance/runtime evidence boundary | Runtime ledger inspection exits with assurance/runtime evidence tooling; no native compiler command.                       |
| `cert-create`         | `packages/wesley-cli/src/commands/cert-create.mjs`     | Assurance boundary                  | Certificate workflow exits the compiler front door.                                                                        |
| `cert-sign` / `stake` | `packages/wesley-cli/src/commands/cert-sign.mjs`       | Assurance boundary                  | Move with certificate tooling if still needed.                                                                             |
| `cert-verify`         | `packages/wesley-cli/src/commands/cert-verify.mjs`     | Assurance boundary                  | Move with certificate tooling if still needed.                                                                             |
| `cert-badge`          | `packages/wesley-cli/src/commands/cert-badge.mjs`      | Assurance boundary or delete        | Keep only with certificate tooling.                                                                                        |

## Shadow Inventory

| Shadow                   | Why it matters                                                                 | Disposition                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| README package matrix    | Can imply npm package authority even when Rust is the product spine.           | Update continuously as packages are ported, extracted, or deleted.                                                            |
| `docs/END_TO_END.md`     | Can accidentally tell the system story through old packages.                   | Keep Rust-native pipeline first; describe Node only as historical support.                                                    |
| `docs/ENTRYPOINTS.md`    | Controls operator command choice.                                              | Keep native CLI and `cargo xtask` first.                                                                                      |
| `docs/GUIDE.md`          | Controls contributor lane choice.                                              | Keep Rust core and native CLI as core lane.                                                                                   |
| CI job names             | Can hide product checks behind legacy package checks.                          | Rust checks use `Rust Product`; historical host checks use `Legacy Compatibility`; repo-wide checks use `Repository Hygiene`. |
| `pnpm wesley` examples   | Can resurrect Node as the apparent front door.                                 | Allow only in compatibility/migration docs until retired.                                                                     |
| JS/Rust parity sentinels | Useful while migrating, harmful if they keep legacy JS as permanent authority. | Archive as historical evidence after Rust self-consistency is sufficient.                                                     |
| `package.json` scripts   | Can keep the Node workspace as the release spine.                              | Retire scripts as their package surfaces close.                                                                               |
| `pnpm-lock.yaml`         | Carries dependency families for legacy packages.                               | Shrink only after package deletion; do not churn early.                                                                       |

## First Drift Check

Before deleting major Node surfaces, add automation that fails when:

- a new package under `packages/` lacks a ledger disposition
- docs promote `pnpm wesley` as the primary command
- JS compiler files gain new public compiler behavior without a Rust counterpart
- a CI job uses a legacy package check as the only product health signal
