# Extending Wesley

This guide explains how to extend Wesley safely by adding new generators and adapters without breaking the core’s purity or public APIs.

- Core stays pure (no node:*). Add pure utilities under `packages/wesley-core/src/util/` when needed.
- Add adapters (filesystem, shell, network) in `@wesley/host-node` and inject via the CLI.
- For new outputs (e.g., additional SQL dialects), create a generator module under core and cover with snapshot tests.

See also: docs/README.md → Implementation and CI boundaries.

