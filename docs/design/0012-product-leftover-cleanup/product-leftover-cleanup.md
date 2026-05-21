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

## Non-Goals

- Do not delete historical design packets that are already marked as
  extraction context.
- Do not change Echo or jedit artifact compatibility.
- Do not rewrite the whole repository around terminology cleanup.
- Do not touch sibling repos in this Wesley cleanup slice.
