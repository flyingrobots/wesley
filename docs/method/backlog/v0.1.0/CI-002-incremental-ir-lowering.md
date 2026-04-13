---
title: CI-002 — Incremental IR Lowering
lane: v0.1.0
release: v0.1.0
---

# CI-002 — Incremental IR Lowering

Legend: [SOURCE — Source Authority]

## Idea

The Wesley compiler currently lowers the full GraphQL SDL tree into IR on every command. For giant schemas, this creates a performance bottleneck in the inner-loop.

Implement "Incremental Lowering":
1. Partition the schema into logical fragments (e.g. by Type or Namespace).
2. Cache the lowered IR for each fragment in `.wesley-cache/ir/`.
3. Only re-lower fragments whose authored source has changed.
4. Compose the final IR from cached and fresh fragments.

## Why

1. **Performance**: Significantly reduces the latency of `wesley compile` and `wesley plan`.
2. **Scalability**: Enables Wesley to handle enterprise-scale schemas without becoming slow.
3. **Efficiency**: Minimizes redundant computation in the CI loop.

## Effort

Large — requires a fragment-aware parser and a robust dependency-tracking cache for the IR.
