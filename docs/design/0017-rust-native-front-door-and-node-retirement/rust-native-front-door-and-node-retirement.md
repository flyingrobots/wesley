# Rust Native Front Door And Node Retirement

## Status

Active packet.

## Question

How does Wesley retire the historical Node surface without deleting useful
compiler, emitter, evidence, or compatibility behavior before Rust owns the
truth?

## Hill

Wesley has one product spine:

1. Rust compiler kernel in `crates/wesley-core`.
2. Native command body in `crates/wesley-cli`.
3. Rust emitters or external modules for selected output surfaces.
4. Legacy Node packages only as compatibility evidence, migration harnesses, or
   extracted tooling while their disposition is still open.

The goal is not "rewrite every JavaScript file in Rust." The goal is to remove
Node as compiler authority, runtime authority, release authority, and hidden
documentation authority.

## Decision

The retirement campaign is a 96-slice campaign tracked in `docs/BEARING.md`.
The active ledger lives in
[`NODE_RETIREMENT_LEDGER.md`](./NODE_RETIREMENT_LEDGER.md).

The first ten slices establish the runway:

- reset `BEARING` around the campaign
- open this design packet
- promote the retirement ledger
- record the Rust parser choice
- classify current Node packages and commands
- add the Rust-core SDL normalizer
- expose `wesley normalize-sdl`
- add golden normalized-SDL fixtures
- update native front-door docs
- reconcile pulled backlog cards into the packet and changelog

## Parser Choice

Rust Wesley stays on `apollo-parser`.

That choice is no longer a pending spike. It is the parser decision for the
Node-retirement runway because it provides:

- CST/trivia access for future high-fidelity diagnostics and formatting
- resilient parsing with collected diagnostics
- close alignment with the GraphQL spec
- a tool-building shape that fits compiler work better than a server-oriented
  parser AST

The cost is CST verbosity and dependency footprint. That is acceptable because
the retirement path needs diagnostics and source fidelity more than a minimal
parser dependency list.

## Rust SDL Normalizer

`wesley normalize-sdl --schema <path>` prints the Rust compiler's deterministic
semantic SDL view:

- extensions folded into their base types
- types sorted lexicographically by name
- fields and arguments sorted lexicographically by name
- union members and enum values sorted lexicographically
- GraphQL type references rendered from Rust L1 facts
- directive data rendered from the compiler-retained directive value model

This is a pre-compilation truth anchor. It is not a source-preserving
formatter. Comments, original ordering, and trivia are not retained because the
current output intentionally renders semantic compiler facts.

## Retirement Rule

Every Node surface gets one disposition before it can disappear:

| Disposition | Meaning |
| --- | --- |
| Port | Rebuild the useful behavior in Rust. |
| Extract | Move the behavior to the owning repo, module, or package family. |
| Delete | Remove it once current consumers no longer depend on it. |
| Defer | Keep temporarily because the owning Rust or external shape is not yet designed. |

No file is deleted merely because it is JavaScript. A file is deleted when its
capability has been ported, extracted, or proven unnecessary.

## Non-Goals

- Do not rebuild every historical Node command one-for-one in Rust.
- Do not preserve the Node command framework as architectural truth.
- Do not move Echo, jedit, Continuum, WARPspace, PostgreSQL, or Supabase
  product semantics back into Wesley core.
- Do not choose N-API, WASM, or another binding strategy from preference alone.
  Use the binding observatory and parity evidence.
- Do not treat JavaScript docs tooling or website tooling as product runtime
  authority.

## Drift Checks Needed

The next slices should add automated guardrails:

- new Node packages require a ledger disposition
- docs cannot promote `pnpm wesley` as the product front door
- legacy package command references must be either compatibility docs or linked
  to an active retirement gate
- `packages/wesley-core` cannot gain new compiler authority without a Rust
  counterpart or explicit rejection note

## Acceptance

This packet is healthy when the campaign can answer, for every remaining Node
surface:

1. What useful behavior does it still carry?
2. Is that behavior compiler truth, tooling, evidence, host compatibility, or
   external product/domain behavior?
3. Is the exit path port, extract, delete, or defer?
4. What test or document proves the current classification?
