# @wesley/cli

Command-line interface for the Wesley compiler kernel and assurance toolchain.
Wesley owns GraphQL parsing, lowering, generic artifact plumbing, module
loading, and evidence surfaces. Domain targets are brought by external modules.

## Usage

```bash
pnpm wesley --help
pnpm wesley transform --schema path/to/schema.graphql --transmutation null-generator --out-dir out
pnpm wesley typescript --schema path/to/schema.graphql
pnpm wesley zod --schema path/to/schema.graphql
WESLEY_MODULES=/path/to/module.mjs pnpm wesley --help
```

Set `WESLEY_MODULES` or configure `wesley.config.mjs` to load external module
commands and module-owned compile targets.

See `pnpm wesley --help` for the full list of generic commands, including
`cert-*` assurance surfaces.

Repeated local schema workflows reuse a hash-addressed IR cache in
`.wesley-cache/ir/`, so `generate`, `typescript`, and `zod` do not need to
re-lower unchanged SDL on every invocation.

Any remaining product and database commands still present in this package are
extraction debt. New domain-specific commands, targets, policies, and runtime
workspace conventions belong in external modules, then load into Wesley.

## Development

- Run the Bats test suite: `pnpm --filter @wesley/cli test`
- Install/refresh Bats plugins: `pnpm run setup:bats-plugins`
- Host CLI entrypoint: `@wesley/host-node/bin/wesley.mjs`, which loads `src/program.mjs`
- Legacy exported compatibility wrapper: `src/main.mjs`

## Status

Status: Active
![pkg-cli](https://github.com/flyingrobots/wesley/actions/workflows/pkg-cli.yml/badge.svg?branch=main)

Experimental package with real working command surfaces. The active cleanup is
to keep the CLI generic while moving product and database surfaces into
external modules.
