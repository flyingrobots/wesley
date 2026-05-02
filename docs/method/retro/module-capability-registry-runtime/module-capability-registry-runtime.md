# Module Capability Registry Runtime

## Outcome

Wesley now has a basic runtime registry for module capabilities. Loaded modules
can contribute structured arrays under:

- `wesley`
- `holmes`
- `watson`
- `moriarty`
- `blade`
- `cli`

The registry records each contribution with the owning module name, so later
base verbs can dispatch through module-owned capabilities without static
product or database imports.

## Landed Surface

- `WesleyModule` now accepts optional structured `capabilities`.
- `createModuleCapabilityRegistry` normalizes capability areas and collections.
- `discoverModules` returns both loaded modules and `capabilityRegistry`.
- CLI module loading stores the registry on `ctx.moduleCapabilityRegistry`.
- The hermetic CLI fixture module contributes capabilities across every
  supported area.

## Verification

```bash
node --test packages/wesley-core/test/unit/module-discovery.test.mjs
node --test packages/wesley-cli/test/module-loading.test.mjs
```

## Remaining Work

- `wesley compile` still needs to consume `wesley.targets` from the registry.
- Holmes, Watson, Moriarty, and BLADE still need real dispatch over their
  module-provided capability collections.
- Product and database residue still needs deletion or relocation after
  module-driven target dispatch exists.
