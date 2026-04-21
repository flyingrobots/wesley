# Wesley core PostgreSQL-family export leak

- Lane: `bad-code`
- Legend: `OWN`

## Why now

Wesley now says clearly that:

- base Wesley should be domain-empty
- Continuum and Postgres are extension modules
- the compiler base should own generic machinery, not product or substrate
  semantics

`packages/wesley-core/src/index.mjs` is still one of the quickest reality checks
for whether that doctrine is actually true. Right now it is not yet true enough.

The file still exports PostgreSQL-family behavior directly from the base
package, including:

- GraphQL/Postgres type mapping
- Postgres generators
- pgTAP generators
- migration explanation and lock semantics
- CIC orchestration and related DB-specific logic

As long as that remains true, Wesley core is still serving as a disguised
database module host.

## Hill

`wesley-core` stops exporting PostgreSQL-family behavior directly and becomes an
honest base compiler package again.

## Done looks like

- `packages/wesley-core/src/index.mjs` no longer re-exports Postgres-family
  behavior
- the moved behavior has a real home behind the Postgres module story
- downstream consumers use module capability registration or module-local
  packages instead of `wesley-core` exports for database semantics
- the extraction map can treat this leak as closed rather than still-active
  debt

## Repo Evidence

- `packages/wesley-core/src/index.mjs`
- `docs/design/wesley-extraction-map.md`
- `docs/WARP_DRIFT.md`
- `../up-next/SOURCE_module-capability-registry-runtime.md`

