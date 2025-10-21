# @wesley/host-node

Node.js host runtime that wires the pure `@wesley/core` engine into CLI adapters.

## Responsibilities

- Filesystem and shell adapters for CLI commands.
- Entry binary (`bin/wesley.mjs`) invoked by `pnpm wesley …`.
- Streaming logs, error handling, and environment guards (dirty workspace detection, etc.).

## Development

```bash
pnpm --filter @wesley/host-node test
```

Source lives in `src/` (adapters + helpers). Tests cover file emission, CLI wiring, and guard rails.
