# Continuum Ownership Map For Shared Nouns

- Lane: `asap`
- Legend: `SOURCE`

## Why now

Continuum only stays coherent if shared nouns have one owner. Wesley needs an
explicit ownership map for globally shared nouns so `git-warp`, Echo,
`warp-ttd`, and Wesley do not drift into overlapping authority claims.

## Hill

For every globally shared noun Wesley touches, the repo can answer who owns the
contract, who consumes it, and what each neighboring system explicitly does not
own.

## Done looks like

- one owner is named for each shared noun family
- Wesley's role is written as contract compilation, not runtime or storage
  policy
- boundary mistakes are called out explicitly, especially around substrate facts
  and debugger policy
- the ownership map is easy to reuse in future design packets and reviews

## Repo Evidence

- `docs/invariants/governance-boundaries.md`
- `docs/architecture/holmes-counterfactuals.md`
- `docs/architecture/continuum-stack.tex`
- `docs/plans/ttd-protocol-compiler.md`

## Related Carry-Over

- `#365`
- `#366`
- `#450`
