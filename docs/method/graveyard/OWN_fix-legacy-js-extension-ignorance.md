# Retired: Fix legacy JS extension ignorance

## What was retired

The ASAP backlog item `OWN_fix-legacy-js-extension-ignorance.md` was retired.

## Why

Design packet `0012-product-leftover-cleanup` updated the legacy JS
`GraphQLAdapter` so `buildIRFromAST` folds object type extensions into their
base object definitions before constructing table IR. The fixture generator no
longer carries a manual type-extension folding workaround.

## Reopen condition

Reopen only if parser parity work finds another GraphQL extension family that
must be folded by the legacy JS hot path, or if object type extension behavior
diverges from Rust lowering on the canonical fixture corpus.
