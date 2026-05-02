# Freeze or clone module capability registry entries

- Lane: `bad-code`
- Legend: `RUNTIME`

## Why now

The first module capability registry intentionally keeps the ownership wrapper
simple:

```js
{ moduleName, value }
```

That is the right first seam, but `value` currently points directly at the
module-owned capability object. Registry consumers could mutate that object and
accidentally change module-owned state.

## Hill

Capability registry consumers cannot mutate module-owned capability objects by
accident.

## Done looks like

- normalized registry entries freeze or clone capability values
- function-valued hooks remain callable
- tests prove a consumer mutation attempt cannot change the original
  module-owned capability metadata
- the registry remains small and does not grow a second capability validator

## Repo Evidence

- `packages/wesley-core/src/application/ModuleCapabilityRegistry.mjs`
- `packages/wesley-core/test/unit/module-discovery.test.mjs`
