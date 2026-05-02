# Compile Target Discovery From Modules

## Outcome

`wesley compile` now builds its target list from
`ctx.moduleCapabilityRegistry.capabilities.wesley.targets` and dispatches
selected targets through module-provided `compile()` hooks.

Base Wesley owns:

- target lookup
- alias normalization
- requested-target validation
- dispatch
- schema-hash agreement checks

Modules own:

- target metadata
- target aliases
- compile hook implementation
- target result shape

## Compatibility Superseded

The first landing kept `warp-ttd` and `echo` as temporary compatibility
descriptors. A later cleanup removed those descriptors; `wesley compile` is now
module-target-only.

## Landed Surface

- `compile` reads module target capabilities through the registry.
- module target results are recorded under `summary.generatedTargets`.
- target errors now list module-discovered target names.
- the hermetic fixture module provides a real `fixture-target` compile hook.
- CLI tests prove `wesley compile --target fixture-target` can run without
  importing product or database repos.

## Verification

```bash
node --test packages/wesley-core/test/unit/module-discovery.test.mjs
node --test packages/wesley-cli/test/module-loading.test.mjs
WESLEY_REPO_ROOT="$PWD" bats packages/wesley-cli/test/compile.bats
pnpm run preflight
```

## Remaining Work

- standalone Continuum command surfaces still need relocation or deletion
- any future Continuum realization verification must live in a Continuum-owned
  module rather than generic Wesley
