# Fixture Extension Module Capability Matrix

## Outcome

The hermetic CLI fixture module now exercises every supported module capability
area and collection without depending on product, database, or downstream
project repos.

The fixture remains a contract/spec proof target. It does not add production
Holmes, Watson, Moriarty, or BLADE dispatch behavior.

## Landed Surface

- `test-extension-module` contributes one minimal capability to every
  collection advertised by `WESLEY_MODULE_CAPABILITY_COLLECTIONS`.
- Core registry tests verify every supported collection is normalized with
  module ownership.
- CLI module-loading tests inspect every fixture capability through
  `ctx.moduleCapabilityRegistry`.
- Fixture BLADE capabilities include local environment, test, and gate hooks,
  including a deterministic gate rejection path.
- Existing fixture CLI command dispatch and compile target dispatch still prove
  the two runtime paths already wired through modules.

## Validation

```bash
node --test packages/wesley-core/test/unit/module-discovery.test.mjs
node --test packages/wesley-cli/test/module-loading.test.mjs
pnpm run preflight
```

## Remaining Work

- Holmes, Watson, Moriarty, and BLADE still need real production dispatch over
  module-owned capability collections.
- Legacy product and database residue still needs relocation or deletion after
  the module seam has enough coverage to protect the cut.
