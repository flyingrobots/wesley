# HOLMES Moriarty option sharing

- Lane: `bad-code`
- Legend: `EVIDENCE`

## Why now

`packages/wesley-holmes/src/cli.mjs` repeats MORIARTY option wiring and context
mapping between `predict` and `report`. Counterfactual and persisted-run options
are easy to update in one command and forget in the other.

## Hill

HOLMES `predict` and `report` share one MORIARTY option and context builder, so
future counterfactual/runtime context changes land once.

## Done looks like

- shared helpers add `--run-id`, `--transmutation`, `--counterfactual`,
  `--counterfactual-braid`, and `--explain`
- shared helpers map options into the `buildMoriartyPrediction` input
- tests prove `predict` and `report` expose the same MORIARTY context options
- JSON output remains backward compatible for both commands
- command help stays clear about which context belongs to MORIARTY

## Repo Evidence

- `packages/wesley-holmes/src/cli.mjs`
- `packages/wesley-holmes/test/`
- `docs/audit/2026-05-05_ship-readiness.md`
