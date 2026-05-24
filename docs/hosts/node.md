# Node Host

The Node.js host is a legacy compatibility surface. It composes Wesley's
historical `@wesley/core` engine with Node-specific adapters and exposes the
old JavaScript CLI while the Rust-native CLI takes over product authority.

- Package: `@wesley/host-node`
- Entrypoint: `packages/wesley-host-node/bin/wesley.mjs`
- Logging: pino (pretty in dev)
- FS: Node fs/promises
- Child process: used for optional shell helpers

Quick checks

```bash
pnpm --filter @wesley/host-node run test
node packages/wesley-host-node/bin/wesley.mjs --version
```

Use native `wesley` examples for new product documentation. Node host examples
belong in legacy compatibility or migration contexts only.
