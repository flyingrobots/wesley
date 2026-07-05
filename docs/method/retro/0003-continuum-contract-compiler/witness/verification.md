---
title: 'Verification Witness'
---

Date: 2026-04-06

## Commands

```text
$ rg -n "This cycle only counts as proved|Wesley does not yet ship|The current witness command proves only" docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md
69:Wesley does not yet ship the chosen receipt-family schema, one literal
75:This cycle only counts as proved when the chosen family has all of the
192:The current witness command proves only the present minimum surface:

$ node packages/wesley-host-node/bin/wesley.mjs compile-ttd --schema schemas/ttd-protocol.graphql --out-dir .wesley-cache/continuum/local-inspect/ttd >/dev/null

$ node packages/wesley-host-node/bin/wesley.mjs bundle-echo --schema schemas/echo-core-types.graphql --out-dir .wesley-cache/continuum/local-inspect/echo >/dev/null

$ node packages/wesley-host-node/bin/wesley.mjs witness-continuum --ttd-dir .wesley-cache/continuum/local-inspect/ttd --echo-dir .wesley-cache/continuum/local-inspect/echo --json > /tmp/wesley-witness-continuum.json

$ jq '{success, result: {kind, scope, status, outputPath, summary}}' /tmp/wesley-witness-continuum.json
{
  "success": true,
  "result": {
    "kind": "wesley.continuum.conformance.v1",
    "scope": "current-minimum-shared-surface",
    "status": "pass",
    "outputPath": ".wesley-cache/continuum/local-inspect/witness/conformance.json",
    "summary": {
      "totalChecks": 10,
      "passed": 10,
      "failed": 0
    }
  }
}

$ jq -e '.success == true and .result.kind == "wesley.continuum.conformance.v1" and .result.scope == "current-minimum-shared-surface" and .result.status == "pass" and .result.outputPath == ".wesley-cache/continuum/local-inspect/witness/conformance.json" and (.result.summary | has("totalChecks") and has("passed") and has("failed"))' /tmp/wesley-witness-continuum.json >/dev/null

```

## Interpretation

- The design packet itself still says the hill is incomplete until the frozen
  chosen-family lane exists.
- The current inspect and witness path is real and re-runnable for the present
  minimum surface.
- The remaining proof work is no longer represented by a repo-local queue. Live
  carry-over belongs in GitHub Issues and owning repos, so the cycle can close
  honestly as `partial` without preserving deleted tracker files in the current
  checkout.
