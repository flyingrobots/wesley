# HOLMES/Moriarty Counterfactual Policy Spec (v2)

<!-- docs-truth: status=current owner=@flyingrobots -->

Purpose

- Configure module-provided counterfactual analysis without changing code.
- Keep the policy surface small and reviewed in-repo.
- Keep provider-specific fact machinery outside generic Holmes.

Files

- `wesley.holmes-policy.json` - checked in, reviewed in PRs
- `wesley.holmes-policy.local.json` - optional developer override, gitignored

CLI

- `holmes predict --counterfactual [baseRef]`
- `holmes report --counterfactual [baseRef]`
- `holmes predict --counterfactual-braid <ref>`
- `holmes report --counterfactual-braid <ref>`

Notes

- Policy v1 is still read, but it is upcast into the v2 counterfactual shape at runtime.
- New policy files should use v2 directly.
- Counterfactual providers come from loaded Wesley modules under
  `holmes.counterfactualProviders`.

## JSON Shape

```json
{
  "version": 2,
  "counterfactual": {
    "enabled": true,
    "provider": null,
    "baseRef": "main",
    "headRef": "HEAD",
    "braidRefs": [],
    "scope": null,
    "gateMode": "audit",
    "penalties": {
      "divergence": 10,
      "destructiveTransfer": 30,
      "providerUnavailable": 50
    }
  }
}
```

## Fields

Top level

- `version`: number, required, currently `2`
- `counterfactual`: object, required

`counterfactual`

- `enabled`: boolean
  - Enables counterfactual analysis when the command is policy-driven rather
    than flag-driven.
- `provider`: string or `null`
  - Selects a loaded `holmes.counterfactualProviders` capability by name.
  - `null` lets Holmes use the sole loaded provider. If zero or multiple
    providers are loaded, Holmes writes an unsupported report explaining the
    missing or ambiguous provider selection.
- `baseRef`: string
  - Base branch or ref to compare against.
- `headRef`: string
  - Defaults to `HEAD`.
- `braidRefs`: string[]
  - Optional overlay refs for braid lanes.
- `scope`: object or `null`
  - Provider-owned scope payload. Generic Holmes passes it through and does not
    interpret provider-specific fields.
- `gateMode`: `"off" | "audit" | "hard"`
  - `off`: never block
  - `audit`: record `wouldFail`, never block
  - `hard`: fail when `judgment.gate === "fail"`
- `penalties`
  - `divergence`: number
  - `destructiveTransfer`: number
  - `providerUnavailable`: number

## Provider Contract

A provider capability is a plain object with a non-empty `name` and an
`analyze()` hook. Holmes calls it with:

```js
{
  (repoRoot, lane, includeTransferPlan, policy, surface, env, provider, moduleName);
}
```

The provider returns a counterfactual report. Generic Holmes normalizes missing
top-level fields, writes `.wesley-cache/counterfactual/current.json`, and leaves
provider-specific fact files to the provider.

## Judgment Model

Counterfactual reports persist:

- `provider`
- `providerPackageVersion`
- `surfaceVersion`
- `laneFingerprint`
- `composition`
- `requested`
- `resolved`
- `facts.comparison`
- `facts.transferPlan`
- `facts.normalizedScope`
- `judgment.status`
- `judgment.signals[]`
- `judgment.riskClass`
- `judgment.confidenceAdjustment`
- `judgment.gate`
- `judgment.wouldFail`
- `judgment.reasons[]`

Gate states

- `pass`
- `audit`
- `fail`

Risk classes

- `none`
- `low`
- `high`

The important rule is simple:

- BLADE and cert consumers must use `judgment.gate` as the only authority.
- They must not re-derive gate semantics from raw provider facts.

## Artifact Layout

Generic Holmes writes:

```text
.wesley-cache/counterfactual/
  current.json
```

Provider modules may write additional fact files under
`.wesley-cache/counterfactual/` if they need provider-owned evidence,
summaries, or caches. Generic Holmes does not define those provider internals.

## Defaults

Runtime defaults if no policy file exists:

- `enabled: false`
- `provider: null`
- `baseRef: "main"`
- `headRef: "HEAD"`
- `braidRefs: []`
- `scope: null`
- `gateMode: "off"`
- penalties:
  - divergence: `10`
  - destructiveTransfer: `30`
  - providerUnavailable: `50`

## Current Implementation

Implemented now

- Holmes/Moriarty `--counterfactual`
- Holmes `--counterfactual-braid` on `predict` and `report`
- Holmes/Moriarty `--run-id` and `--transmutation` for persisted run binding
- module-provided counterfactual provider dispatch
- unsupported reports when no provider capability is loaded
- Moriarty report `runtime` block sourced from the run ledger
- Moriarty report `counterfactual` block
- legacy merge-tree/worktree projection retained in tests only as a regression harness
- BLADE counterfactual stage
- SHIPME embedding of compact counterfactual summary
- BLADE hard/audit/off behavior via `judgment.gate`
- `cert-verify` respects embedded `counterfactual.gate` and requires `holmes.shipVerdict === "ELEMENTARY"`

Not yet implemented

- user-facing scope controls
- provider-specific public docs for external product modules
- a Continuum-owned counterfactual provider package

## Sources

- [Holmes counterfactual provider capability](./design/0008-holmes-counterfactual-provider-capability/holmes-counterfactual-provider-capability.md)
- [Wesley module capability contract](./design/wesley-module-capability-contract.md)
