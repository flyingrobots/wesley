---
title: "Verification Witness"
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

$ node packages/wesley-host-node/bin/wesley.mjs witness-continuum --ttd-dir .wesley-cache/continuum/local-inspect/ttd --echo-dir .wesley-cache/continuum/local-inspect/echo --json
{
  "success": true,
  "result": {
    "kind": "wesley.continuum.conformance.v1",
    "scope": "current-minimum-shared-surface",
    "status": "pass",
    "outputPath": ".wesley-cache/continuum/local-inspect/witness/conformance.json",
    "summary": {
      "totalChecks": 8,
      "passed": 8,
      "failed": 0
    }
  }
}

$ sed -n '1,120p' docs/method/backlog/asap/README.md
# ASAP

Items here should be pulled soon. They are closer to commitment than `up-next/`
or `inbox/`.

Current pull order for the Continuum cluster:

1. `SOURCE_continuum-ownership-map-for-shared-nouns.md`
2. `RUNTIME_continuum-local-compile-and-inspect-surface.md`
3. `EVIDENCE_continuum-conformance-and-roundtrip-witness.md`
```

## Interpretation

- The design packet itself still says the hill is incomplete until the frozen
  chosen-family lane exists.
- The current inspect and witness path is real and rerunnable for the present
  minimum surface.
- The remaining proof work is still explicitly queued in `asap/`, so the cycle
  can close honestly as `partial` without losing the carry-over.
