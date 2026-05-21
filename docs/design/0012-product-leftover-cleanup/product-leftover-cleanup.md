---
title: Product Leftover Cleanup
legend: OWN
packet: 0012-product-leftover-cleanup
status: active
release: v0.0.5
---

# Product Leftover Cleanup

## Sponsors

- Human: I can look at Wesley's active queue and know that the next work is
  compiler cleanup, not another Echo, jedit, Continuum, PostgreSQL, or Supabase
  product lane.
- Agent: I can pull active work without rediscovering which repo owns each
  product or database concern.

## Hill

Wesley's active docs, backlog, command surfaces, tests, package metadata, and
extraction map no longer treat product or database behavior as generic Wesley
responsibility.

## Why This Cycle Exists

Wesley's architecture has moved to a stricter domain-empty boundary:

- Wesley owns compiler truth, generic module contracts, generic artifact
  plumbing, and generic evidence plumbing.
- Product/runtime behavior belongs in the owning product repo or product-owned
  module.
- PostgreSQL/Supabase behavior belongs in `wesley-postgres`.

The repo still carried active backlog cards that contradicted that direction or
described already-completed cleanup as future work. This packet exists to make
that bookkeeping honest before the release moves into IR fixtures and Rust
parity.

## Playback Questions

1. Do active backlog lanes still contain work that should obviously be owned by
   jedit, Echo, Continuum, `warp-ttd`, `git-warp`, or `wesley-postgres`?
2. Do active ASAP cards still describe false current code facts?
3. Are historical Continuum/Echo/TTD notes visibly historical rather than
   active Wesley doctrine?
4. Are remaining product-shaped fixtures described as compiler fixtures rather
   than product ownership?
5. Does the extraction map still match current tracked source/package truth?

## First Slice

The first slice is documentation and queue cleanup only.

It:

- pulls this cleanup work out of `docs/method/backlog/asap/`
- retires active cards whose evidence is already false against current Rust IR
  and JSON schema truth
- retires external product/runtime cards that should not remain in Wesley's
  active queue
- leaves implementation behavior untouched

## Governance Docs Slice

The root governance files are part of the release front door.

This slice:

- updates `CONTRIBUTING.md` so contributors see Wesley as the module-first
  semantic contract compiler and assurance toolchain
- updates `SECURITY.md` so security posture centers trusted modules, generated
  artifact review, evidence integrity, and explicit external ownership for
  database/runtime/product policy
- retires the matching bad-code card because root governance no longer claims
  database-change product ownership as generic Wesley doctrine

## IR Metadata Slice

The first IR-truth cleanup keeps the existing JS IR metadata shape but removes
the clock from parity-sensitive bytes.

This slice:

- replaces runtime `generatedAt` timestamps in the JS GraphQL adapter with a
  stable epoch value
- updates host-node parser IR tests to assert deterministic metadata across
  repeated parses of the same SDL
- retires the matching ASAP card because identical SDL no longer changes JS IR
  bytes solely because wall-clock time advanced

## Schema Extension Slice

The legacy JS adapter now folds object type extensions before table IR
construction.

This slice:

- merges `extend type` fields and directives into the base object definition
  in `GraphQLAdapter.buildIRFromAST`
- rejects object type extensions that do not have a base definition
- removes the manual type-extension folding workaround from
  `scripts/generate-ir-fixtures.mjs`
- retires the matching ASAP card because the JS hot path now owns the behavior
  the fixture script was previously simulating

## v0.1.0 Lane Slice

The old `docs/method/backlog/v0.1.0/` lane predated the current domain-empty
release bearing.

This slice:

- moves the lane to `docs/method/graveyard/v0.1.0/`
- updates docs signposts that previously presented the lane as active release
  carry-over
- preserves the files as historical extraction context for Continuum-era design
  references and future repo-specific coordination

## Product-Era Docs Slice

Some public docs still presented database generation and older package
architecture as current generic Wesley behavior.

This slice:

- retires the row-level-security feature page to the graveyard because RLS,
  generated SQL, helper functions, and pgTAP tests belong in
  `wesley-postgres`
- retires the older architecture overview to the graveyard because the current
  authoritative system map is `docs/ARCHITECTURE.md`
- removes the stale overview from the docs start path

## Non-Goals

- Do not delete historical design packets that are already marked as
  extraction context.
- Do not change Echo or jedit artifact compatibility.
- Do not rewrite the whole repository around terminology cleanup.
- Do not touch sibling repos in this Wesley cleanup slice.
