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
Its machine-readable export lives in
[`node-retirement-ledger.json`](./node-retirement-ledger.json) and is checked
by `cargo xtask docs-check`.
The current legacy command decisions live in
[`LEGACY_COMMAND_DECISIONS.md`](./LEGACY_COMMAND_DECISIONS.md).
Assurance and module-runtime extraction decisions live in
[`ASSURANCE_AND_CAPABILITY_EXTRACTION.md`](./ASSURANCE_AND_CAPABILITY_EXTRACTION.md).

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

`wesley normalize-sdl --schema <path> --hash` prints the SHA-256 of that
normalized SDL. The hash is evidence for the semantic SDL view, not a
replacement for the L1 IR registry hash.

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

## Current Command Decisions

Native Wesley keeps explicit generic emit commands for retained model and
operation-binding output:

```bash
wesley doctor
wesley emit rust --schema <path> --out <path> --metadata-out <path>
wesley emit typescript --schema <path> --out <path> --metadata-out <path>
```

The native `doctor` command is intentionally narrow: it checks only the Rust
CLI, Rust lowerer, normalized SDL hash evidence, and Rust emitter crates. It
does not recreate the legacy Node command's config, plugin, package, or Node
runtime diagnostics.

The legacy umbrella `generate` command is being replaced by these explicit
native commands plus external modules for target-owned outputs. Legacy `zod`,
`models`, and `init` behavior is not being recreated in core Wesley during this
campaign; each is either external target work or product scaffolding outside the
compiler kernel.

Certificate, Holmes/Moriarty, run-ledger, and package-evidence commands are
not native compiler-front-door commands. They exit with assurance tooling or
remain compatibility-only until that boundary exists.

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
