# Node Retirement Ledger

This ledger is the active inventory for retiring the historical Node Wesley
surface. `docs/LEGACY_NODE_MIGRATION.md` remains the public migration summary;
this packet ledger is the working control surface for the 96-slice campaign.
The machine-readable CI/review export lives beside this document as
[`node-retirement-ledger.json`](./node-retirement-ledger.json).
The row-by-row retirement gate summary lives in
[`LEGACY_COMPATIBILITY_MATRIX.md`](./LEGACY_COMPATIBILITY_MATRIX.md).
Deletion audit evidence lives in
[`LEAF_PACKAGE_DELETION_AUDIT.md`](./LEAF_PACKAGE_DELETION_AUDIT.md) and
[`GENERATOR_JS_DELETION_AUDIT.md`](./GENERATOR_JS_DELETION_AUDIT.md).
The terminal closeout lives in
[`FINAL_CLOSEOUT.md`](./FINAL_CLOSEOUT.md).

## Dispositions

| Disposition | Meaning                                                                |
| ----------- | ---------------------------------------------------------------------- |
| Port        | Rebuild useful behavior in Rust.                                       |
| Extract     | Move useful behavior to an owning repo, module, or package family.     |
| Delete      | Remove after dependents and evidence no longer need it.                |
| Defer       | Keep temporarily because the replacement boundary is not designed yet. |

## Package Inventory

| Surface                         | Current role                                                         | Disposition              | Retirement gate                                                                           |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `packages/wesley-holmes/`       | Self-contained Holmes/Moriarty assurance and counterfactual tooling. | Extract or rebuild later | Assurance tooling has an explicit package/repo boundary separate from compiler authority. |
| `packages/wesley-host-browser/` | Browser-host smoke experiment.                                       | Delete or externalize    | Browser host evidence stays external to compiler authority.                               |
| `packages/wesley-host-bun/`     | Bun-host smoke experiment.                                           | Delete or externalize    | Bun host evidence stays external to compiler authority.                                   |
| `packages/wesley-host-deno/`    | Deno-host smoke experiment.                                          | Delete or externalize    | Deno host evidence stays external to compiler authority.                                  |

## Current Deletion Blockers

None. The final four compatibility packages were deleted in NR-076 through
NR-079, and the closeout is published in `FINAL_CLOSEOUT.md`.

## Retired Package Inventory

| Surface                                 | Slice  | Outcome | Replacement / owner                                                                                                                   |
| --------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/wesley-core/`                 | NR-076 | Deleted | Rust crates own retained compiler authority; Holmes owns only local assurance helpers copied from the old package.                    |
| `packages/wesley-cli/`                  | NR-077 | Deleted | The native Rust CLI owns the product front door; Holmes owns retained assurance commands.                                             |
| `packages/wesley-host-node/`            | NR-078 | Deleted | No product, test, or workflow path shells through the old Node executable wrapper.                                                    |
| `packages/wesley-runtime-node/`         | NR-079 | Deleted | Holmes-local support owns retained ledger and module capability helpers.                                                              |
| `packages/wesley-generator-vue/`        | NR-081 | Deleted | Vue projection ownership exits generic Wesley; reintroduce it only through an external target owner.                                  |
| `packages/wesley-generator-js/`         | NR-080 | Deleted | Rust TypeScript emitters own retained product TypeScript output; model classes and core Zod output were rejected from generic Wesley. |
| `packages/wesley-scaffold-multitenant/` | NR-082 | Deleted | Product scaffolding exits generic Wesley; future scaffolds belong to an owning product repository.                                    |
| `packages/wesley-test-fixtures/`        | NR-083 | Deleted | Useful fixtures live as plain `test/fixtures` assets or Rust tests, not as a workspace package.                                       |
| `packages/wesley-tasks/`                | NR-084 | Deleted | Rust `TransmutationRunner` keeps descriptor-only task graph evidence without a JavaScript task runtime.                               |

## Command Inventory

| Legacy command        | Current file | Disposition                         | Rust or external exit                                                                                                       |
| --------------------- | ------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `generate`            | Deleted      | Ported/rejected/deleted             | Native `emit` commands and external modules replace useful outputs; do not preserve the umbrella command as a core noun.    |
| `transform`           | Deleted      | Deleted                             | Compatibility wrapper around generation; do not recreate as a core noun by default.                                         |
| `compile`             | Deleted      | Deferred for redesign               | Replace Node module dispatch with Rust registry or external-process target protocol if a concrete module consumer needs it. |
| `typescript` / `ts`   | Deleted      | Partially ported                    | `wesley emit typescript` owns retained generic TypeScript output.                                                           |
| `zod`                 | Deleted      | Rejected from core                  | Zod is JavaScript validation output; richer Zod output needs an external target owner.                                      |
| `models`              | Deleted      | Deleted                             | Model-class scaffolding is not compiler truth; retained generic model facts live in Rust and TypeScript emitters.           |
| `diff`                | Deleted      | Ported for L1 structure             | `wesley schema diff` owns generic schema diff; operation-argument deltas remain separate.                                   |
| `init`                | Deleted      | Retired legacy scaffolding          | Future native `init` may only create tiny generic starter schemas and must be designed as new work, not as a Node port.     |
| `doctor`              | Deleted      | Narrow port complete                | `wesley doctor` runs Rust-native health checks only.                                                                        |
| `validate-bundle`     | Deleted      | Assurance boundary                  | Reintroduce only beside assurance tooling.                                                                                  |
| `runs`                | Deleted      | Assurance/runtime evidence boundary | Holmes owns retained runtime ledger inspection.                                                                             |
| `cert-create`         | Deleted      | Assurance boundary                  | Certificate workflow exits the compiler front door.                                                                         |
| `cert-sign` / `stake` | Deleted      | Assurance boundary                  | Move with certificate tooling if still needed.                                                                              |
| `cert-verify`         | Deleted      | Assurance boundary                  | Move with certificate tooling if still needed.                                                                              |
| `cert-badge`          | Deleted      | Assurance boundary or deleted       | SHIPME workflow now emits its badge directly from fixture evidence.                                                         |

## Shadow Inventory

| Shadow                   | Why it matters                                                                 | Disposition                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| README package matrix    | Can imply npm package authority even when Rust is the product spine.           | Update continuously as packages are ported, extracted, or deleted.                                                    |
| `docs/END_TO_END.md`     | Can accidentally tell the system story through old packages.                   | Keep Rust-native pipeline first; describe Node only as historical support.                                            |
| `docs/ENTRYPOINTS.md`    | Controls operator command choice.                                              | Keep native CLI and `cargo xtask` first.                                                                              |
| `docs/GUIDE.md`          | Controls contributor lane choice.                                              | Keep Rust core and native CLI as core lane.                                                                           |
| CI job names             | Can hide product checks behind old package checks.                             | Rust checks use product language; host checks are external host experiments; repo-wide checks use repository hygiene. |
| `pnpm wesley` examples   | Can resurrect Node as the apparent front door.                                 | Allow only in compatibility/migration docs until retired.                                                             |
| JS/Rust parity sentinels | Useful while migrating, harmful if they keep legacy JS as permanent authority. | Archived as historical evidence; parity scripts are deleted.                                                          |
| `package.json` scripts   | Can keep the Node workspace as the release spine.                              | Retired when their package surfaces closed.                                                                           |
| `pnpm-lock.yaml`         | Carries dependency families for legacy packages.                               | Shrink only after package deletion; do not churn early.                                                               |

## First Drift Check

Before deleting major Node surfaces, add automation that fails when:

- a new package under `packages/` lacks a ledger disposition
- docs promote `pnpm wesley` as the primary command
- JS compiler files gain new public compiler behavior without a Rust counterpart
- a CI job uses a legacy package check as the only product health signal
