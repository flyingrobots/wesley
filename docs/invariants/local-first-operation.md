# local-first-operation

## Invariant statement

Core Wesley workflows must work from a local checkout, local files, local
runtime state, and explicitly chosen adapters. Remote services may assist, but
they are optional overlays rather than required authorities.

## Preserved when

- operators can transform, plan, rehearse, inspect, and investigate from local
  repo state
- docs default to local commands and local fixtures
- remote CI, dashboards, and review tools remain sidecars rather than the only
  place truth is available

## Violated when

- normal product workflows require GitHub, a hosted dashboard, or another
  network dependency just to understand local truth
- local caches or outputs cannot be interpreted without remote lookup
- docs train operators to treat external systems as the canonical source for
  core Wesley behavior

## How to check

- prefer commands and tests that run from the local repo, local fixtures, and
  local ledger state
- challenge any new requirement that makes a remote system mandatory for basic
  operator understanding or replay
