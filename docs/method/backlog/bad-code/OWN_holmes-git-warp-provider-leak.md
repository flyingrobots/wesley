# Holmes git-warp provider leak

- Lane: `bad-code`
- Legend: `OWN`

## Why now

Holmes is supposed to be a generic evidence/witness engine.

It still carries a product-specific counterfactual backend in generic shared
code:

- imports `@git-stunts/plumbing`
- imports `@git-stunts/git-warp`
- defaults to a `git-warp` provider in policy

That is useful bootstrap and bad long-term ownership. As long as this remains in
generic Holmes, the repo is still teaching that product-specific counterfactual
logic belongs in the base engine instead of in a module.

## Hill

Holmes becomes a cleaner generic engine by moving the `git-warp` counterfactual
provider out of generic Wesley-owned code and into the owning module layer.

## Done looks like

- the provider and policy defaults no longer live in generic Holmes code
- Holmes consumes a module-provided counterfactual capability instead of a
  hard-coded backend
- Continuum or another owning module provides the `git-warp`-specific behavior
- the base engine remains capable without pretending product semantics are core

## Repo Evidence

- `packages/wesley-holmes/src/counterfactual/provider.mjs`
- `packages/wesley-holmes/src/counterfactual/policy.mjs`
- `docs/design/wesley-extraction-map.md`
- `docs/design/wesley-module-capability-contract.md`

