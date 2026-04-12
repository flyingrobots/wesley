# @wesley/cli

Command-line interface for turning GraphQL schemas into database artifacts (SQL, migrations, RLS, pgTAP) and running operational workflows (plan, rehearse, certify, blade).

## Usage

```bash
pnpm wesley --help
pnpm wesley generate --schema path/to/schema.graphql --emit-bundle
pnpm wesley compile --schema <continuum-root>/schemas/continuum-receipt-family.graphql --target warp-ttd,echo --out-dir .wesley-cache/continuum/local-inspect
pnpm wesley witness --scope receipt-family --schema <continuum-root>/schemas/continuum-receipt-family.graphql --out-dir .wesley-cache/continuum/local-inspect
pnpm wesley plan --schema path/to/schema.graphql --explain
pnpm wesley rehearse --schema path/to/schema.graphql --dry-run --json
```

See `pnpm wesley --help` for the full list of commands (including `blade`, `cert-*`, and experimental `--ops` support).

## Development

- Run the Bats test suite: `pnpm --filter @wesley/cli test`
- Install/refresh Bats plugins: `pnpm run setup:bats-plugins`
- Host CLI entrypoint: `@wesley/host-node/bin/wesley.mjs`, which loads `src/program.mjs`
- Legacy exported compatibility wrapper: `src/main.mjs`

## Status

Status: Active
![pkg-cli](https://github.com/flyingrobots/wesley/actions/workflows/pkg-cli.yml/badge.svg?branch=main)

Experimental package with real working command surfaces. The database-change
lane is more mature than the Continuum lane, and experimental features
(`--ops`) remain flagged in the CLI help text.
