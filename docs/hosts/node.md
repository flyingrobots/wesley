# Node Host

The Node.js host composes Wesley’s pure `@wesley/core` engine with Node‑specific adapters and exposes the CLI.

- Package: `@wesley/host-node`
- Entrypoint: `packages/wesley-host-node/bin/wesley.mjs`
- Logging: pino (pretty in dev)
- FS: Node fs/promises
- Child process: used for optional shell helpers (planner/runner)

Quick checks

```bash
pnpm --filter @wesley/host-node run test
node packages/wesley-host-node/bin/wesley.mjs --version
```

See the root README for end‑to‑end CLI examples.

