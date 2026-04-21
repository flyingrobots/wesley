# Module capability registry runtime

- Lane: `up-next`
- Legend: `SOURCE`
- Rank: `1`

## Why now

Wesley now has the doctrine it was missing:

- modules own domain behavior
- base Wesley owns verbs and engines
- Continuum and Postgres are extension modules
- `wesley compile` must discover targets from loaded modules

What Wesley still does **not** have is the runtime shape to make that doctrine
true in code. The current `WesleyModule` contract is good enough to load a
module and register CLI commands. It is not yet good enough to express the
actual architecture we now want.

If this stays vague, the repo will keep falling back to two bad patterns:

- static imports from product repos because the registry is too weak
- more docs about module semantics without the runtime being able to honor them

## Hill

Wesley has one real capability registry runtime that loaded modules can
contribute to, and the registry is strong enough to power the base verbs
without hard-coded product semantics.

The registry should support capability areas for:

- `wesley`
- `holmes`
- `watson`
- `moriarty`
- `blade`
- `cli`

## Done looks like

- one runtime registry shape exists for module capabilities instead of only
  command registration
- loaded modules can contribute structured capabilities without patching Wesley
  internals
- the registry clearly separates required versus optional module slices
- the registry is explicit about ownership:
  - base Wesley owns dispatch and validation
  - modules own domain capabilities
- at least one hermetic fixture module proves registration across more than one
  capability area
- the capability registry becomes the default seam for future Continuum and
  Postgres cutovers

## Repo Evidence

- `docs/design/wesley-module-capability-contract.md`
- `packages/wesley-core/src/ports/WesleyModule.mjs`
- `packages/wesley-core/src/application/ModuleDiscovery.mjs`
- `packages/wesley-cli/src/framework/module-loader.mjs`
- `packages/wesley-cli/test/module-loading.test.mjs`

