# Retired: Remove non-deterministic IR metadata

## What was retired

The ASAP backlog item `OWN_remove-non-deterministic-ir-metadata.md` was
retired.

## Why

Design packet `0012-product-leftover-cleanup` removed wall-clock timestamp
generation from the JS GraphQL adapter's IR metadata. The adapter still emits
the existing `metadata.generatedAt` shape for compatibility, but the value is a
stable epoch timestamp so repeated parses of identical SDL no longer produce
different JS IR bytes solely because time advanced.

## Reopen condition

Reopen only if canonical fixture generation, registry hashing, or JS/Rust
parity evidence finds another nondeterministic field in IR bytes that should be
stable or moved outside the parity-sensitive IR envelope.
