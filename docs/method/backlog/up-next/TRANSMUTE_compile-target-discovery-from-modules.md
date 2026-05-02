# Compile target discovery from modules

- Lane: `up-next`
- Legend: `TRANSMUTE`
- Rank: `1`

## Why now

The architecture is now clear:

- `wesley compile` stays in Wesley
- targets do **not** stay hard-coded in Wesley
- modules provide domain targets and their generation machinery

The current repo is still in the uncomfortable middle:

- the command is correctly thought of as base Wesley
- the implementation is still too product-shaped

Until this cut lands, Wesley will keep saying "modules own domain targets"
while the code still teaches "compile knows the product lanes."

## Hill

`wesley compile` becomes a generic target dispatcher over loaded module
capabilities instead of a domain-shaped command with embedded product
knowledge.

## Done looks like

- `compile` asks loaded modules which targets exist
- requested targets are validated against the loaded target registry
- generation dispatch happens through module-provided target/generator metadata
- target listing and error messages are module-aware and explicit
- product and database modules can contribute targets without changing Wesley
  base code
- the command no longer needs hard-coded product, runtime, database, or
  hosted-platform assumptions in order to be useful

## Repo Evidence

- `docs/design/wesley-module-capability-contract.md`
- `docs/design/wesley-extraction-map.md`
- `packages/wesley-cli/src/commands/compile.mjs`
- `packages/wesley-core/src/ports/GeneratorPlugin.mjs`
- `packages/wesley-core/src/ports/WesleyModule.mjs`
