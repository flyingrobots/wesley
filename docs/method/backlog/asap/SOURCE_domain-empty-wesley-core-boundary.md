# Domain-empty Wesley core boundary

- Lane: `asap`
- Legend: `SOURCE`
- Rank: `1`

## Why now

Wesley's architectural boundary is now stricter:

- Wesley is the core `GraphQL -> whatever` compiler and assurance toolchain
- external modules bring the `whatever`
- product behavior does not live in this repo
- PostgreSQL/Supabase behavior does not live in this repo

The repo still carries historical product and database residue in docs,
packages, commands, schemas, tests, and package metadata. As long as those
surfaces look like Wesley features, contributors will keep adding domain
behavior to the wrong place.

## Hill

Wesley names and enforces one domain-empty core boundary: generic compiler,
generic toolchain, generic module contracts, and hermetic fixture modules only.

## Done looks like

- front-door docs describe Wesley as a core compiler and module host, not as a
  product or database tool
- active backlog no longer treats product compiler lanes as Wesley ASAP work
- module capability runtime is the next implementation seam
- target dispatch is module-owned
- product-specific commands, generators, schemas, policies, fixtures, and
  workspace tools have explicit external homes or removal plans
- PostgreSQL/Supabase behavior has an explicit `wesley-postgres` extraction
  path

## Must not do

- add new product behavior to Wesley while "waiting for extraction"
- add new PostgreSQL/Supabase behavior to `wesley-core` or generic hosts
- keep product demos as front-door Wesley examples
- treat historical product packets as active Wesley doctrine

## Repo Evidence

- `README.md`
- `docs/GUIDE.md`
- `docs/ARCHITECTURE.md`
- `docs/BEARING.md`
- `docs/design/wesley-module-contract.md`
- `docs/design/wesley-module-capability-contract.md`
- `docs/design/wesley-extraction-map.md`
- `packages/wesley-cli/src/commands/compile.mjs`
- `packages/wesley-core/src/index.mjs`
