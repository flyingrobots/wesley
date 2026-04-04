# governance-boundaries

## Invariant statement

Supporting libraries and adapters provide facts and capabilities. Wesley owns
product judgment, governance semantics, and operator-facing meaning. Boundary
crossings must stay explicit.

## Preserved when

- substrate tools such as git-warp remain fact machines, not product doctrine
- shared use cases and ports carry cross-surface behavior instead of one CLI
  shelling out to another
- core stays free of UI leakage, storage-shaped UX, and Node-only orchestration

## Violated when

- Wesley reimplements substrate semantics casually inside product code
- substrate language leaks into product guarantees without an explicit mapping
- architectural seams collapse and infrastructure details start driving normal
  operator UX

## How to check

- inspect architecture notes, adapter seams, and product-facing output for
  clear boundaries between fact collection, translation, and Wesley-native
  judgment
- challenge new code that shells one CLI through another or drags Node-only
  orchestration into core
