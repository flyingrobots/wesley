# HOLMES Counterfactual Architecture

<!-- docs-truth: status=current owner=@flyingrobots -->

This is the canonical architecture note for Wesley counterfactual analysis.

Scope

- HOLMES/Moriarty read-only counterfactual analysis
- BLADE counterfactual stage
- SHIPME counterfactual summary

## Boundary

Holmes is the generic counterfactual dispatcher and judgment carrier.

Loaded modules own provider semantics:

- ref or lane interpretation beyond the generic request shape
- comparison or transfer machinery
- provider-owned fact files
- provider-owned cache state
- provider-specific scope payloads

Wesley-owned consumers use only the normalized report shape and
`judgment.gate`. They must not import a product-specific provider or
re-derive gate semantics from provider internals.

## Provider Layout

Generic implementation

- package: `packages/wesley-holmes`
- policy loader: `src/counterfactual/policy.mjs`
- dispatcher: `src/counterfactual/provider.mjs`
- runtime run lookup: shared `@wesley/core` run-store use cases plus the shared
  `@wesley/runtime-node` ledger adapter
- module loading: shared `@wesley/runtime-node` module-entry loader

Module implementation

- capability area: `holmes`
- capability collection: `counterfactualProviders`
- capability shape: plain object with non-empty `name` and `analyze()` hook

Entrypoints

- `wesley`
- `holmes`
- `moriarty`

Current rule

- these remain independent entry points
- Holmes/Moriarty may consume Wesley artifacts and the shared run ledger, but
  they must not shell out to the `wesley` CLI just to inspect persisted run
  state
- Holmes and Moriarty emit their own command streams into the shared ledger
  under command-specific transmutation names instead of appending events onto a
  bound Wesley runtime stream
- Holmes exposes read-only `runs status|inspect` commands over the same shared
  ledger through the same core/runtime-node seams, so operational introspection
  does not require the `wesley` entry point

## Lane Model

Lane request

- `baseRef`
- `headRef`
- optional `braidRefs[]`
- optional `scope`
- `composition: merge | braid`

Holmes normalizes the lane request and passes it to the selected provider. The
provider may resolve refs, compare surfaces, plan transfer, or perform a
different counterfactual analysis appropriate to its module.

Provider selection

- If `policy.counterfactual.provider` names a loaded provider, Holmes uses it.
- If no provider is named and exactly one provider is loaded, Holmes uses that
  provider.
- If no provider is available, or more than one provider is available without an
  explicit selection, Holmes writes a valid unsupported report.

## Facts and Judgment

Generic persisted report

- `.wesley-cache/counterfactual/current.json`

Provider-owned artifacts

- may live under `.wesley-cache/counterfactual/`
- may include comparison facts, transfer facts, summaries, caches, or other
  module-specific evidence
- are not part of the generic Holmes contract unless represented in
  `current.json`

`current.json` carries

- provider name and version
- surface version
- requested and resolved refs
- normalized scope
- lane fingerprint
- optional fact summaries
- Wesley judgment

Judgment fields

- `status`
- `signals[]`
- `riskClass`
- `confidenceAdjustment`
- `gate`
- `wouldFail`
- `reasons[]`

Generic signal

- `provider_unavailable`

Common provider signals may include:

- `patch_divergence`
- `visible_state_delta`
- `transfer_ops_present`
- `destructive_transfer_ops_present`
- `content_clear_ops_present`
- `scope_applied`
- `braid_present`

## Consumers

Moriarty

- `holmes predict --counterfactual [baseRef]`
- `holmes report --counterfactual [baseRef]`
- `holmes predict --counterfactual-braid <ref>`
- `holmes report --counterfactual-braid <ref>`
- `holmes predict --run-id <id> [--transmutation <name>]`
- `holmes report --run-id <id> [--transmutation <name>]`
- Report output:
  - `runtime`
  - `counterfactual`
  - `explain.readiness.counterfactual`
- Legacy merge-tree/worktree projection code remains in tests only as a
  one-release regression harness.

BLADE

- stage between `rehearse` and `cert-create`
- flags:
  - `--counterfactual [baseRef]`
  - `--counterfactual-braid <ref>`

SHIPME / cert

- `cert-create` embeds a compact counterfactual summary
- `cert-verify` respects embedded `counterfactual.gate`

## Gate Semantics

This is the critical rule:

- `judgment.gate` is the only authority for BLADE and cert decisions.

Policy gate modes

- `off`
- `audit`
- `hard`

Derived gate states

- `pass`
- `audit`
- `fail`

Current behavior

- `off`: never block
- `audit`: record `wouldFail`, continue
- `hard`: fail when `judgment.gate === "fail"`

## References

- [Holmes counterfactual provider capability](../design/0008-holmes-counterfactual-provider-capability/holmes-counterfactual-provider-capability.md)
- [Wesley module capability contract](../design/wesley-module-capability-contract.md)
