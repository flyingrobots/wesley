# Echo / warp-ttd Proof Family Compilation

- Lane: `up-next`
- Legend: `SOURCE`
- Rank: `1`

## Why now

Continuum now states the assignment plainly:

1. declare the shared GraphQL family in Continuum
2. compile it with Wesley
3. run Echo against the generated Rust side
4. have `warp-ttd` consume the generated TypeScript side of the same family

Echo already has handwritten neighborhood and settlement publication, and
`warp-ttd` still has a handwritten `src/protocol.ts` mirror. Wesley is the
missing compiler lane that turns those temporary proof surfaces into one real
contract path.

## Hill

Wesley compiles one Continuum-authored proof family into:

- Rust artifacts Echo can compile against
- TypeScript artifacts `warp-ttd` can import directly
- codec metadata and schema identity that both sides share

The first proof family should be narrow and boring, but it must cover:

- neighborhood core
- reintegration detail
- settlement delta / plan / result
- receipt shell boundary
- one rewrite op with declared footprint

## Done looks like

- one Continuum-authored family is selected as the proof slice
- Wesley emits Rust and TypeScript realizations for that family
- generated codecs are sufficient for the Echo <-> `warp-ttd` transport path
- Echo can replace proof-slice handwritten DTOs with generated Rust cousins
- `warp-ttd` can replace proof-slice handwritten TS mirrors with generated
  TypeScript cousins
- one compile-fail fixture exists for a footprint violation on the Echo side

## Repo Evidence

- Continuum `0015-echo-wesley-warp-ttd-proof-plan`
- Continuum `0016-engine-local-vs-shared-observer-contract`
- Continuum `0017-settlement-publication-and-shared-reintegration`
- `schemas/continuum-receipt-family.graphql`
- `docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md`
