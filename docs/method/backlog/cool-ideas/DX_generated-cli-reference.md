# Generated CLI reference

- Lane: `cool-ideas`
- Legend: `DX`

## Why now

The docs command checker now guards front-door `pnpm wesley` examples, but
readers still do not have a stable reference page generated from the actual CLI
registry. A generated or snapshot-backed reference would make command truth easy
to inspect without running local help.

## Hill

A reader can open one docs page and see the current Wesley command tree, aliases,
options, and examples backed by the actual Commander registry.

## Done looks like

- `docs/reference/cli.md` is generated or checked from `pnpm wesley --help` and
  per-command help output
- the reference includes commands, aliases, options, exit-code notes, and common
  examples
- README and GUIDE link to the reference
- preflight fails when the generated reference drifts from the current CLI help

## Repo Evidence

- `packages/wesley-cli/src/program.mjs`
- `packages/wesley-cli/src/commands/`
- `scripts/check-doc-cli-commands.mjs`
- `README.md`
- `docs/GUIDE.md`
