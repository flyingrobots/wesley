# Continuum Ownership Map For Shared Nouns

- Lane: `asap`
- Legend: `SOURCE`

## Why now

The current bearing now names a specific Continuum stack: WARP-facing shared
contracts, a TTD protocol lane, an Echo codec lane, and `git-warp`
on the substrate fact side. Without an ownership map, maintainers still have
to infer which repo owns each shared noun family and which generated surfaces
are consumer contracts versus local mirrors. The WARP optic framing also raises
another boundary problem: projection nouns, witness nouns, and receipt nouns
are easy to blur together unless the map names their role explicitly.

## Hill

For every globally shared noun Wesley touches, the repo can answer who owns the
contract, who consumes it, what role the noun plays in the WARP optic shape,
and what each neighboring system explicitly does not own.

## Done looks like

- one owner is named for each WARP-facing shared noun family Wesley currently
  carries or plans to compile next
- the ownership map is a table, not only prose; it names at least `Noun`,
  `Role`, `Owner`, `Authored or generated`, `Source of truth`, `Consumers`,
  and `Out of scope`
- Wesley's role is written as contract compilation, publication boundary, and
  judgment bridge, not runtime or storage policy
- projection nouns such as `Observer` and `Lens` are not casually presented as
  the full rewrite optic
- witness nouns are separated from receipt envelopes, and the map says which
  surfaces are semantic residue versus larger operational shell
- `git-warp` fact export, Echo runtime semantics, and `warp-ttd` observer
  policy are called out explicitly as neighboring authority, not Wesley-owned
  doctrine
- boundary mistakes are called out explicitly, especially around substrate
  facts, debugger policy, handwritten mirrors, and projection-versus-witness
  confusion
- the ownership map is easy to reuse in future design packets and reviews

## Repo Evidence

- `docs/invariants/governance-boundaries.md`
- `docs/architecture/continuum-minimum-shared-contract-surface.md`
- `docs/architecture/continuum-wesley-role.md`
- `docs/architecture/holmes-counterfactuals.md`
- `docs/architecture/continuum-stack.tex`

## Related Carry-Over

- `#365`
- `#366`
- `#450`
