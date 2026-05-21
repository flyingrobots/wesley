# Delete product leftovers after capability cut

- Lane: `asap`
- Legend: `OWN`
- Rank: `2`

## Why now

Wesley's module capability runtime and module-driven target discovery have
landed far enough that old product and database residue should stop lingering
as active Wesley work.

Earlier cleanup slices removed the obvious built-in Continuum, Echo, TTD,
WARPspace, PostgreSQL, and Supabase package/command surfaces. The remaining
work is the honest verification pass: make sure the active repo no longer
advertises or exercises product behavior as if it belongs to generic Wesley.

## Hill

Wesley can prove its active docs, backlog, command surfaces, tests, package
metadata, and extraction map no longer treat product or database behavior as
generic Wesley responsibility.

## Done looks like

- every active backlog item that belongs in jedit, Echo, Continuum,
  `warp-ttd`, `git-warp`, or `wesley-postgres` is moved, archived, or rewritten
  as external-module compatibility work
- stale docs and internal imports that imply Wesley-owned product behavior are
  removed or marked historical
- removed command/package rows in `docs/design/wesley-extraction-map.md` match
  the actual filesystem and package metadata
- product-shaped fixtures that remain in Wesley are clearly hermetic compiler
  fixtures, not product ownership
- PostgreSQL/Supabase work has an explicit `wesley-postgres` follow-through
  path

## Must not do

- recreate product commands or generators inside Wesley while cleaning up old
  references
- break Echo or jedit artifact compatibility as an accidental side effect
- delete historical docs that are clearly archived history
- turn this into broad codebase refactoring unrelated to product-leftover
  verification

## Repo Evidence

- `docs/BEARING.md`
- `docs/design/wesley-extraction-map.md`
- `docs/method/backlog/`
- `docs/design/README.md`
- `packages/`
- `crates/`
- `schemas/`
