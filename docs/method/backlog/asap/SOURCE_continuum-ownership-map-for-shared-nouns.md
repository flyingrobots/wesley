# Continuum Ownership Map For Shared Nouns

- Lane: `asap`
- Legend: `SOURCE`

## Why now

The current bearing now names a specific Continuum stack: WARP-facing shared
contracts, a TTD protocol lane, an Echo codec / decodec lane, and `git-warp`
on the substrate fact side. Without an ownership map, maintainers still have
to infer which repo owns each shared noun family and which generated surfaces
are consumer contracts versus local mirrors.

## Hill

For every globally shared noun Wesley touches, the repo can answer who owns the
contract, who consumes it, and what each neighboring system explicitly does not
own.

## Done looks like

- one owner is named for each WARP-facing shared noun family Wesley currently
  carries or plans to compile next
- Wesley's role is written as contract compilation, publication boundary, and
  judgment bridge, not runtime or storage policy
- `git-warp` fact export, Echo runtime semantics, and `warp-ttd` observer
  policy are called out explicitly as neighboring authority, not Wesley-owned
  doctrine
- boundary mistakes are called out explicitly, especially around substrate
  facts, debugger policy, and handwritten mirrors
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
