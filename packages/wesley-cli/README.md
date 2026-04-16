# @wesley/cli

Command-line interface for turning GraphQL schemas into database artifacts (SQL, migrations, RLS, pgTAP) and running operational workflows (plan, rehearse, certify, blade).

## Usage

```bash
pnpm wesley --help
pnpm wesley generate --schema path/to/schema.graphql --emit-bundle
pnpm wesley transform --schema path/to/schema.graphql --transmutation null-generator --out-dir out
pnpm wesley typescript --schema path/to/schema.graphql
pnpm wesley zod --schema path/to/schema.graphql
pnpm wesley compile --schema "$CONTINUUM_ROOT"/schemas/continuum-receipt-family.graphql --target warp-ttd,echo --out-dir .wesley-cache/continuum/local-inspect
pnpm wesley contract release --profile continuum --family receipt-family --schema "$CONTINUUM_ROOT"/schemas/continuum-receipt-family.graphql --release 0.1.0
pnpm wesley contract sync --profile continuum --bundle .wesley-cache/contracts/continuum/receipt-family/0.1.0 --consumer warp-ttd --repo ../warp-ttd
pnpm wesley verify-realization --tracked
pnpm wesley witness --scope receipt-family --schema "$CONTINUUM_ROOT"/schemas/continuum-receipt-family.graphql --out-dir .wesley-cache/continuum/local-inspect
pnpm wesley drift-watch --scope receipt-family --schema "$CONTINUUM_ROOT"/schemas/continuum-receipt-family.graphql --out-dir .wesley-cache/continuum/local-inspect --mirror-root ../warp-ttd
pnpm wesley plan --schema path/to/schema.graphql --explain
pnpm wesley rehearse --schema path/to/schema.graphql --dry-run --json
```

Set `CONTINUUM_ROOT` to the root of your local Continuum checkout before using the shared-family examples above.

See `pnpm wesley --help` for the full list of commands (including `blade`, `cert-*`, and experimental `--ops` support).

Repeated local schema workflows reuse a hash-addressed IR cache in `.wesley-cache/ir/`, so `generate`, `plan`, `rehearse`, `up`, `typescript`, and `zod` do not need to re-lower unchanged SDL on every invocation.

WARPspace defaults now cover both single-file and Continuum multi-file outputs.
If a project carries `warpspace.toml`, `wesley typescript` and `wesley zod`
resolve their default output files from `outputs.typescript` and `outputs.zod`,
while `wesley compile-ttd` and `wesley bundle-echo` resolve their default
output roots from `outputs.warp_ttd` and `outputs.echo_ir`. A local
`.warpspace.local.toml` file may override those roots for development, and
explicit `--out-file`, `--out-dir`, or `--warpspace` flags still win.

`drift-watch` is the local cutover surface for nearby Continuum consumers. It verifies the authored schema hash, local generated legs, realization shell, and any explicit mirror roots you point it at, then reports drift as an authored, generated-artifact, or mirror-boundary problem.
The Continuum defaults behind `witness` and `drift-watch` now come from
`@wesley/continuum`, which owns the shared-family scopes, publication-boundary
policy, and the Continuum judgment profile for Holmes, Watson, and Moriarty.
`contract release` uses those same profile defaults to emit one versioned
contract bundle with `bundle.json`, realization, witness output, admitted
source metadata, and declared consumer projections. `contract sync` then
copies those declared projections into a neighboring consumer root such as
`warp-ttd` or Echo's checked-in `ttd-protocol-ts` package, then writes a
bundle-scoped sync verification report and fails if the consumer surface still
drifts after copy.

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
