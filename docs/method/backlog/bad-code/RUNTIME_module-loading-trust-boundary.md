# Module loading trust boundary

- Lane: `bad-code`
- Legend: `RUNTIME`

## Why now

`wesley.config.mjs` and `WESLEY_MODULES` are now central extension points, and
HOLMES counterfactual providers can arrive through module capabilities. The
loader currently executes configured Node modules directly, which is expected
for trusted local extension code, but that trust boundary is not yet formalized
in CLI controls, diagnostics, or release docs.

## Hill

A release or CI operator can choose exactly when external modules are loaded,
can disable them for diagnostics, and can see which trusted code executed.

## Done looks like

- `WESLEY_DISABLE_MODULES=1` or equivalent prevents module imports
- an allowlist mode exists for CI/client workflows
- module loading emits structured diagnostics with config source, env source,
  specifiers, import status, module identity, and capability families
- documentation explicitly states that Wesley modules are trusted Node code
- tests prove disabled and non-allowlisted modules are not imported

## Repo Evidence

- `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs`
- `packages/wesley-cli/src/program.mjs`
- `docs/design/wesley-module-contract.md`
- `docs/design/wesley-module-capability-contract.md`
