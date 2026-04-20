# Migration Strategies

Wesley plans migrations in phases to minimize lock impact and risk:

- Expand → Backfill → Validate → Switch → Contract

MVP defaults focus on additive changes. Backfill/switch/contract phases are
still part of Wesley's longer-range direction tracked through
[BEARING](../BEARING.md), design packets, and milestone notes. Use
`wesley plan --explain` to preview locks and sequencing.
