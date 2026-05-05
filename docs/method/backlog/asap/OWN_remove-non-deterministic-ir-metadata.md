# OWN: Remove Non-deterministic IR Metadata

- Lane: `asap`
- Legend: `OWN`

## Why

The current `GraphQLAdapter.mjs` injects a `generatedAt` timestamp into the IR metadata during every parse. This makes byte-level hash parity impossible across runs and across different implementations (JS vs Rust).

## Done looks like

- `generatedAt` is removed from the core IR used for hashing.
- Metadata is either moved to a separate envelope or initialized with a stable value (e.g., unix epoch) during parity-sensitive operations.
- `registryHash` remains stable across identical SDL inputs.

## Repo Evidence

- `packages/wesley-runtime-node/src/GraphQLAdapter.mjs:150`
