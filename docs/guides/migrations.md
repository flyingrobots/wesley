# Migration Strategies

Wesley plans migrations in phases to minimize lock impact and risk:

- Expand → Backfill → Validate → Switch → Contract

MVP defaults focus on additive changes. Backfill/switch/contract phases are being wired to emit per‑phase SQL (see go-public-checklist.md). Use `wesley plan --explain` to preview locks and sequencing.

