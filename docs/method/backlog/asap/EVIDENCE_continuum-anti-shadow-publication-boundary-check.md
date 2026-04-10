# Continuum Anti-Shadow Publication-Boundary Check

- Lane: `asap`
- Legend: `EVIDENCE`
- Rank: `2`

## Why now

Wesley's Continuum docs now name authored homes, generated surfaces, and the
current minimum shared contract surface clearly enough that the next failure
mode is obvious: the anti-shadow rule is still mostly prose. The current
`witness-continuum` lane proves local coherence for the TTD and Echo minimum
surface, but it does not yet fail when an admitted noun family escapes its
named authored home or reserved generated outputs.

If Wesley is going to earn the claim that it manages publication boundaries,
it needs one boring local check that says when a generated file, compat mirror,
or handwritten helper has started pretending to be peer authority.

## Hill

A maintainer can run one local Wesley check and learn whether an admitted
Continuum contract family has drifted into handwritten shadow authority outside
its named authored schema and reserved generated surfaces.

## Done looks like

- one machine-checkable rule names the authored schema home, reserved generated
  directories, and tolerated compat mirrors for the chosen family
- failures distinguish handwritten shadow contract, stale generated artifact,
  and declared compat mirror
- the check stays local-first and is invokable through `witness-continuum` or
  one adjacent command
- errors tell the maintainer which file became peer authority and how to retire
  or regenerate it
- the rule is exercised first on the current minimum TTD-plus-Echo surface and
  then on the frozen receipt-family lane
- the output strengthens the publication-boundary story without broadening
  Wesley's ownership into runtime or storage semantics

## Repo Evidence

- `docs/BEARING.md`
- `docs/architecture/continuum-wesley-role.md`
- `docs/architecture/continuum-minimum-shared-contract-surface.md`
- `docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md`
- `packages/wesley-cli/src/commands/witness-continuum.mjs`
- `packages/wesley-core/src/domain/SchemaResolver.mjs`
- `docs/invariants/schema-source-of-truth.md`
- `docs/invariants/governance-boundaries.md`

## Related Carry-Over

- `#365`
- `#366`
- `#456`
