# Migration Strategies

Wesley plans migrations in phases to minimize lock impact and risk:

- Expand → Backfill → Validate → Switch → Contract

MVP defaults focus on additive changes. Backfill/switch/contract phases are
still part of the long-range strategy captured in
[docs/roadmap.md](../roadmap.md). Use `wesley plan --explain` to preview locks
and sequencing.
