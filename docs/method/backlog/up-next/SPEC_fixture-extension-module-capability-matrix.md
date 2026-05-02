# Fixture extension module capability matrix

- Lane: `up-next`
- Legend: `SPEC`
- Rank: `2`

## Why now

Wesley core CI should not depend on a real product repo to prove the extension
architecture.

That rule matters even more now that:

- product modules are no longer supposed to live inside generic Wesley
- database modules are being extracted into their own repo
- the module contract is expanding beyond CLI commands

The current fixture coverage proves the loader works. It does not yet prove
that the whole capability stack can be exercised hermetically.

## Hill

Wesley ships one test fixture module family that can exercise every supported
capability area locally in CI without depending on product, database, or any
project-specific repo.

## Done looks like

- one hermetic fixture module registers at least a minimal capability in:
  - `wesley`
  - `holmes`
  - `watson`
  - `moriarty`
  - `blade`
  - `cli`
- the fixture proves capability discovery, dispatch, and error paths
- BLADE-oriented fixture behavior includes environment/test/gate hooks without
  requiring a real downstream project
- CI can validate the extension contract even if no product module repos are
  present on disk
- the fixture becomes the preferred proof target when the module contract
  evolves

## Repo Evidence

- `packages/wesley-cli/test/fixtures/modules/test-extension-module.mjs`
- `packages/wesley-cli/test/module-loading.test.mjs`
- `docs/design/wesley-module-capability-contract.md`
