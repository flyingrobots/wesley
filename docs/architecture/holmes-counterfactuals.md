# HOLMES Counterfactual Architecture
<!-- docs-truth: status=current owner=@flyingrobots -->

This is the canonical architecture note for Wesley counterfactual analysis.

Scope
- HOLMES/Moriarty read-only counterfactual analysis
- BLADE counterfactual stage
- SHIPME counterfactual summary

Substrate
- Package: `@git-stunts/git-warp@14.16.2`
- Runtime floor: Node 22+
- Sources in this document are pinned to the `v14.16.2` tag, not `main`

## Boundary

git-warp is the fact machine.
- comparison
- transfer planning
- visible-state scope normalization
- canonical fact export

Wesley is the judgment machine.
- status
- signals
- risk class
- confidence adjustment
- gate result
- explanations for humans

Wesley must not reimplement git-warp comparison, braid, or transfer semantics inside its event store or deploy ledger.

## Provider Layout

Holmes owns the provider.

Current implementation
- package: `packages/wesley-holmes`
- policy loader: `src/counterfactual/policy.mjs`
- provider: `src/counterfactual/provider.mjs`
- runtime run lookup: shared `@wesley/core` run-store use cases plus the shared `@wesley/runtime-node` ledger adapter
- surface materialization: shared `@wesley/runtime-node` GraphQL/materialization adapters

Entrypoints
- `wesley`
- `holmes`
- `moriarty`

Current rule
- these remain independent entry points
- Holmes/Moriarty may consume Wesley artifacts and the shared run ledger, but they must not shell out to the `wesley` CLI just to inspect persisted run state
- Holmes counterfactual analysis materializes missing surfaces in-process through shared Node adapters, not by invoking another entry point
- Holmes and Moriarty emit their own command streams into the shared ledger under command-specific transmutation names instead of appending events onto a bound Wesley runtime stream

Runtime storage

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

The `store/` subtree is a Holmes counterfactual cache. It is not part of the Wesley run ledger.
`lease.json` governs store expiry, and stale lane summaries plus expired store state are pruned on the next counterfactual analysis run.

## Surface Encoding

Graph namespace
- `wesley-counterfactual-v1`

Surface families
- `artifact:` generated files like `out/schema.sql`
- `evidence:` bundle and verification artifacts
- `plan:` plan JSON summaries
- `realm:` rehearsal verdicts

Current rule
- `score:` stays advisory and out of gating until it is proven reproducible from a resolved ref.

Encoding strategy
- Each encoded surface is one writer in the git-warp graph.
- Stable node IDs are the only public contract:
  - `artifact:<relative-path>`
  - `evidence:bundle`
  - `plan:report`
  - `realm:report`
- File bytes are attached as content for auditability.
- Comparison semantics rely on stable properties like `sha256`, `size`, `family`, and `path`.

## Lane Model

Lane request
- `baseRef`
- `headRef`
- optional `braidRefs[]`
- optional `scope`
- `composition: merge | braid`

Resolution flow
1. Resolve refs to immutable SHAs.
2. Encode the base/head/braid surfaces into the provider graph.
3. Build coordinate selectors over those encoded surfaces.
4. Compare `head (+ braids)` against `base`.
5. Plan transfer from `head (+ braids)` into `base`.
6. Export canonical facts and derive Wesley judgment.

Current braid note
- The current implementation uses coordinate frontiers for braid overlays.
- It does not yet expose user-facing working-set lifecycle management.

## Facts and Judgment

Persisted facts
- `comparison.<factDigest>.json`
- `transfer.<factDigest>.json`

Those files contain the exact `canonicalFactJson` bytes returned by git-warp export helpers.

`summary.json` carries
- provider version
- surface version
- requested and resolved refs
- normalized scope
- lane fingerprint
- digests and export versions
- Wesley judgment

Judgment fields
- `status`
- `signals[]`
- `riskClass`
- `confidenceAdjustment`
- `gate`
- `wouldFail`
- `reasons[]`

Current signals
- `patch_divergence`
- `visible_state_delta`
- `transfer_ops_present`
- `destructive_transfer_ops_present`
- `content_clear_ops_present`
- `scope_applied`
- `braid_present`
- `provider_unavailable`

## Consumers

Moriarty
- `holmes predict --counterfactual [baseRef]`
- `holmes report --counterfactual [baseRef]`
- `holmes predict --run-id <id> [--transmutation <name>]`
- `holmes report --run-id <id> [--transmutation <name>]`
- Report output:
  - `runtime`
  - `counterfactual`
- Legacy merge-tree/worktree projection code remains in tests only as a one-release regression harness.

BLADE
- new stage between `rehearse` and `cert-create`
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

- [git-warp v14.16.2 package.json](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/package.json)
- [git-warp v14.16.2 CHANGELOG.md](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/CHANGELOG.md)
- [git-warp v14.16.2 ARCHITECTURE.md](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/ARCHITECTURE.md)
- [git-warp v14.16.2 WORKING_SETS.md](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/docs/WORKING_SETS.md)
- [git-warp v14.16.2 index.d.ts](https://raw.githubusercontent.com/git-stunts/git-warp/v14.16.2/index.d.ts)
