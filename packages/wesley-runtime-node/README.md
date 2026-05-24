# @wesley/runtime-node

Status: Legacy compatibility surface pending extraction or deletion.

Shared Node.js runtime adapters for historical Wesley-family entry points. This
package is not a product runtime and does not define compiler authority. Native
compiler work belongs in `crates/wesley-core` and `crates/wesley-cli`; future
module execution belongs behind the Rust capability registry or an explicit
external-process protocol.

This package currently exists to keep the legacy architecture hexagonal:

- `@wesley/core` owns pure run/event use cases and ports
- `@wesley/runtime-node` owns reusable Node adapters like the Git-backed ledger store and counterfactual surface ports while those surfaces remain in compatibility lanes
- `@wesley/host-node`, `@wesley/holmes`, and other entry-point packages depend on this package instead of importing one another

Current exports:

- `GitWarpEventStore`
- `GraphQLAdapter`
- `createNodeCounterfactualSurfacePort`
- `collectCounterfactualSurfaceModel`
- `ensureCounterfactualWorkspaceArtifacts`
- `resolveLedgerRootDir`
