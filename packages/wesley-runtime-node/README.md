# @wesley/runtime-node

Shared Node.js runtime adapters for Wesley-family entry points.

This package exists to keep the architecture hexagonal:

- `@wesley/core` owns pure run/event use cases and ports
- `@wesley/runtime-node` owns reusable Node adapters like the Git-backed ledger store and counterfactual surface ports
- `@wesley/host-node`, `@wesley/holmes`, and other entry-point packages depend on this package instead of importing one another

Current exports:

- `GitWarpEventStore`
- `GraphQLAdapter`
- `createNodeCounterfactualSurfacePort`
- `collectCounterfactualSurfaceModel`
- `ensureCounterfactualWorkspaceArtifacts`
- `resolveLedgerRootDir`
