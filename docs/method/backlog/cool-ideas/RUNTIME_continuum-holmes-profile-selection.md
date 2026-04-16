---
title: "Continuum Holmes Profile Selection"
legend: RUNTIME
lane: cool-ideas
---

# Continuum Holmes Profile Selection

## Why this exists

`@wesley/continuum` now owns the Continuum judgment profile for Holmes, Watson, and Moriarty, and the Wesley CLI witness/drift-watch surfaces consume it. The next gap is that `@wesley/holmes` itself still runs as a generic engine without an explicit product-profile selection surface.

## Hill

A Holmes-family run can name and load a product profile such as `@wesley/continuum` directly, so report rendering, verification framing, and prediction defaults do not depend on CLI-only wiring.

## Done looks like

- `@wesley/holmes` can load a named product profile without hardcoding Continuum into the shared engine
- report JSON and markdown identify the active product profile clearly
- profile loading failure is versioned and operator-readable
- Continuum remains one product profile, not the implicit default for all Holmes runs
