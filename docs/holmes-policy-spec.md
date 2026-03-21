# HOLMES/Moriarty Counterfactual Policy Spec (v2)
<!-- docs-truth: status=current owner=@flyingrobots -->

Purpose
- Configure git-warp-backed counterfactual analysis without changing code.
- Keep the policy surface small and reviewed in-repo.
- Separate substrate facts from Wesley judgment.

Files
- `wesley.holmes-policy.json` — checked in, reviewed in PRs
- `wesley.holmes-policy.local.json` — optional developer override, gitignored

CLI
- `holmes predict --counterfactual [baseRef]`
- `holmes report --counterfactual [baseRef]`

Notes
- Policy v1 is still read, but it is upcast into the v2 counterfactual shape at runtime. New policy files should use v2 directly.

## JSON Shape

```json
{
  "version": 2,
  "counterfactual": {
    "enabled": true,
    "provider": "git-warp",
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
  - Enables counterfactual analysis when the command is policy-driven rather than flag-driven.
- `provider`: string
  - Current value: `git-warp`
- `baseRef`: string
  - Base branch or ref to compare against.
- `headRef`: string
  - Defaults to `HEAD`.
- `braidRefs`: string[]
  - Optional overlay refs for braid lanes.
- `scope`: object or `null`
  - Internal visible-state scope passed through to git-warp normalization.
- `gateMode`: `"off" | "audit" | "hard"`
  - `off`: never block
  - `audit`: record `wouldFail`, never block
  - `hard`: fail when `judgment.gate === "fail"`
- `penalties`
  - `divergence`: number
  - `destructiveTransfer`: number
  - `providerUnavailable`: number

## Judgment Model

git-warp produces substrate facts. Wesley derives judgment from those facts.

Counterfactual reports persist:
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
- They must not re-derive gate semantics from raw substrate status.

## Artifact Layout

Counterfactual artifacts live under:

```text
.wesley-cache/counterfactual/
  current.json
  <laneFingerprint>/
    summary.json
    comparison.<factDigest>.json
    transfer.<factDigest>.json
  store/
    lease.json
    surfaces/*.json
```

Rules
- `comparison.<factDigest>.json` contains the exact canonical fact bytes from git-warp export.
- `transfer.<factDigest>.json` contains the exact canonical fact bytes from git-warp export.
- `summary.json` carries digests, resolved refs, versions, and Wesley judgment.
- `current.json` points to the latest lane summary for downstream consumers like `cert-create`.
- `store/lease.json` expires provider-owned git-warp cache state, and expired lane summaries are pruned on the next analysis pass.

## Defaults

Runtime defaults if no policy file exists:
- `enabled: false`
- `provider: "git-warp"`
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
- Holmes/Moriarty `--run-id` and `--transmutation` for persisted run binding
- git-warp provider and canonical fact persistence
- Moriarty report `runtime` block sourced from the run ledger
- Moriarty report `counterfactual` block
- legacy merge-tree/worktree projection retained in tests only as a regression harness
- BLADE counterfactual stage
- SHIPME embedding of compact counterfactual summary
- BLADE hard/audit/off behavior via `judgment.gate`
- `cert-verify` respects embedded `counterfactual.gate`

Not yet implemented
- user-facing scope controls
- public braid CLI for HOLMES
- provider-owned working-set lifecycle beyond the current coordinate-frontier path

## Sources

- [git-warp v14.16.2 package.json](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/package.json)
- [git-warp v14.16.2 index.d.ts](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/index.d.ts)
- [git-warp v14.16.2 ARCHITECTURE.md](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/ARCHITECTURE.md)
- [git-warp v14.16.2 WORKING_SETS.md](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/docs/WORKING_SETS.md)
