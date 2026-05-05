# Module loading structured diagnostics

- Lane: `bad-code`
- Legend: `RUNTIME`

## Why now

`wesley.config.mjs` and `WESLEY_MODULES` are now central extension points, and
HOLMES counterfactual providers can arrive through module capabilities. The
loader now has a disable switch and an allowlist gate for trusted local
extension code. What remains is the operator-facing diagnostic surface that
explains what would load, what was blocked, and which capabilities appeared.

## Hill

A release or CI operator can inspect module loading without reading source or
guessing from environment variables.

## Done looks like

- module loading emits structured diagnostics with config source, env source,
  specifiers, import status, module identity, and capability families
- documentation explicitly states that Wesley modules are trusted Node code
- a CLI surface exposes those diagnostics in human-readable and JSON forms
- missing configs, blocked configs, disabled modules, import failures, and
  loaded capability collections are distinguishable

## Repo Evidence

- `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs`
- `packages/wesley-cli/src/program.mjs`
- `docs/design/wesley-module-contract.md`
- `docs/design/wesley-module-capability-contract.md`
