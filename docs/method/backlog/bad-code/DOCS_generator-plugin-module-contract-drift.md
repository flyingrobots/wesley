# Generator plugin docs use stale config shape

- Lane: `bad-code`
- Legend: `DX`

## Why now

The May 5 audits found that `docs/guides/generator-plugins.md` still teaches a
top-level `generators` entry in `wesley.config.mjs`. Current Wesley module
loading reads `config.modules`, and generator/target behavior should arrive
through loaded module capabilities.

## Hill

A module or generator author can follow the docs and produce a config/module
shape that the current runtime actually loads.

## Done looks like

- `docs/guides/generator-plugins.md` uses `config.modules`
- examples show a minimal external module exporting `capabilities.wesley`
- `docs/guides/extending.md` points users toward modules and capabilities
- examples include at least one `wesley.targets` or `wesley.generators`
  capability
- a docs-truth or fixture check catches obsolete top-level generator config
  examples before release

## Repo Evidence

- `docs/guides/generator-plugins.md`
- `docs/guides/extending.md`
- `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs`
- `docs/design/wesley-module-contract.md`
- `docs/design/wesley-module-capability-contract.md`
- `docs/audit/2026-05-05_code-quality.md`
- `docs/audit/2026-05-05_ship-readiness.md`
