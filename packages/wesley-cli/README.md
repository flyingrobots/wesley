# @wesley/cli

Command-line interface for turning GraphQL schemas into database artifacts (SQL, migrations, RLS, pgTAP) and running operational workflows (plan, rehearse, certify, blade).

## Usage

```bash
pnpm wesley --help
pnpm wesley generate --schema path/to/schema.graphql --emit-bundle
pnpm wesley transform --schema path/to/schema.graphql --transmutation null-generator --out-dir out
pnpm wesley compile --schema "$CONTINUUM_ROOT"/schemas/continuum-receipt-family.graphql --target warp-ttd,echo --out-dir .wesley-cache/continuum/local-inspect
pnpm wesley verify-realization --tracked
pnpm wesley witness --scope receipt-family --schema "$CONTINUUM_ROOT"/schemas/continuum-receipt-family.graphql --out-dir .wesley-cache/continuum/local-inspect
pnpm wesley drift-watch --scope receipt-family --schema "$CONTINUUM_ROOT"/schemas/continuum-receipt-family.graphql --out-dir .wesley-cache/continuum/local-inspect --mirror-root ../warp-ttd
pnpm wesley plan --schema path/to/schema.graphql --explain
pnpm wesley rehearse --schema path/to/schema.graphql --dry-run --json
```

Set `CONTINUUM_ROOT` to the root of your local Continuum checkout before using the shared-family examples above.

See `pnpm wesley --help` for the full list of commands (including `blade`, `cert-*`, and experimental `--ops` support).

Repeated local schema workflows reuse a hash-addressed IR cache in `.wesley-cache/ir/`, so `generate`, `plan`, `rehearse`, `up`, `typescript`, and `zod` do not need to re-lower unchanged SDL on every invocation.

`drift-watch` is the local cutover surface for nearby Continuum consumers. It verifies the authored schema hash, local generated legs, realization shell, and any explicit mirror roots you point it at, then reports drift as an authored, generated-artifact, or mirror-boundary problem.

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
