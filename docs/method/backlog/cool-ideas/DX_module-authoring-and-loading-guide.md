# Module authoring and loading guide

- Lane: `cool-ideas`
- Legend: `DX`

## Why now

The design docs describe the module and capability contracts, but a new module
author still needs a practical path from "make a module" to "verify the module
loaded and contributed capabilities." The counterfactual-provider extraction
makes this more important because HOLMES behavior can now arrive through
external module capabilities.

## Hill

A module author can create, load, inspect, test, and troubleshoot a small Wesley
module without reading internal source files.

## Done looks like

- `docs/guides/module-authoring.md` exists and is linked from README and GUIDE
- the guide includes a minimal module, `wesley.config.mjs`, `WESLEY_MODULES`, a
  capability example, and module-owned command contribution
- the guide includes a `holmes.counterfactualProviders` example
- troubleshooting covers missing configs, failed imports, disabled entries,
  duplicate specifiers, env/config precedence, and trusted-code warnings

## Repo Evidence

- `README.md`
- `docs/GUIDE.md`
- `docs/design/wesley-module-contract.md`
- `docs/design/wesley-module-capability-contract.md`
- `docs/holmes-policy/README.md`
