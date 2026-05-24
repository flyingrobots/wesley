# @wesley/cli

Status: Legacy compatibility surface pending deletion.
![pkg-cli](https://github.com/flyingrobots/wesley/actions/workflows/pkg-cli.yml/badge.svg?branch=main)

Historical command-line interface for the Node-era Wesley toolchain. The native
Rust `wesley` binary is the product front door. This package remains only for
legacy command compatibility, package tests, module-loading migration evidence,
and assurance surfaces that have not yet been extracted.

## Usage

```bash
pnpm wesley --help                 # legacy compatibility wrapper
pnpm wesley zod --schema schema.graphql
WESLEY_MODULES=/path/to/module.mjs pnpm wesley --help
```

For generic compiler work, use the native replacements:

```bash
wesley schema diff --old old.graphql --new new.graphql
wesley schema hash --schema schema.graphql
wesley schema lower --schema schema.graphql --json
wesley emit typescript --schema schema.graphql --out generated/types.ts
```

Set `WESLEY_MODULES` or configure `wesley.config.mjs` only when exercising
legacy module commands and module-owned compile targets.

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
