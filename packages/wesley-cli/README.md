# @wesley/cli

Command-line interface for turning GraphQL schemas into database artifacts (SQL, migrations, RLS, pgTAP) and running operational workflows (plan, rehearse, certify, blade).

## Usage

```bash
pnpm wesley --help
pnpm wesley generate --schema path/to/schema.graphql --emit-bundle
pnpm wesley plan --schema path/to/schema.graphql --explain
pnpm wesley rehearse --schema path/to/schema.graphql --dry-run --json
```

See `pnpm wesley --help` for the full list of commands (including `blade`, `cert-*`, and experimental `--ops` support).

## Development

- Run the Bats test suite: `pnpm --filter @wesley/cli test`
- Install/refresh Bats plugins: `pnpm run setup:bats-plugins`
- CLI entrypoint: `src/main.mjs`

## Status

Status: Active
![pkg-cli](https://github.com/flyingrobots/wesley/actions/workflows/pkg-cli.yml/badge.svg?branch=main)

Production ready; experimental features (`--ops`) are flagged in the CLI help text.
