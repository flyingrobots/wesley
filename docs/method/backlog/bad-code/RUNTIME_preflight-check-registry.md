# Preflight check registry

- Lane: `bad-code`
- Legend: `RUNTIME`

## Why now

`scripts/preflight.mjs` uses global mutable `ok` and `failures` state plus a
long numbered list of inline checks. The current behavior works, but the shape
makes checks harder to test independently and easier to edit inconsistently.

## Hill

Repository preflight is a registry of named checks that return failure messages,
while `pnpm run preflight` preserves its existing user-facing behavior.

## Done looks like

- checks are represented as named functions or objects
- each check returns an array of failure messages instead of mutating global
  state
- process-running checks share one helper
- smoke tests cover at least one passing and one failing check
- current checks remain intact: docs links, docs truth, forbidden literals, docs
  CLI commands, pnpm version, dependency-cruiser, core purity, package hygiene,
  license, progress weights, and docs whitespace

## Repo Evidence

- `scripts/preflight.mjs`
- `package.json`
- `docs/audit/2026-05-05_ship-readiness.md`
