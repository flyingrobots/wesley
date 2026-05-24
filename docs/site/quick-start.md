---
title: Quick Start
---

<!-- docs-truth: status=experimental owner=@flyingrobots -->

# Quick Start

Follow these steps to try Wesley locally. The commands mirror the README but
are condensed here for convenience.

## 1. Clone and install

```bash
git clone https://github.com/flyingrobots/wesley.git
cd wesley
pnpm install
```

## 2. Inspect compiler facts

Lower, hash, and list operations through the native Rust CLI:

```bash
cargo wesley schema lower --schema test/fixtures/examples/ecommerce.graphql --json
cargo wesley schema hash --schema test/fixtures/examples/ecommerce.graphql
cargo wesley schema operations --schema test/fixtures/examples/ecommerce.graphql --json
```

## 3. Emit TypeScript

```bash
cargo wesley emit typescript \
  --schema test/fixtures/examples/ecommerce.graphql \
  --out out/examples/ecommerce.d.ts \
  --metadata-out out/examples/ecommerce.metadata.json
```

The metadata sidecar records schema hash, generator identity, generator
version, and native execution mode.

## 4. Run health checks

```bash
cargo xtask preflight
```

## 5. Next steps

- Explore direction: [docs/BEARING.md](../BEARING.md)
- Read the direction map: [Roadmap](./roadmap.md)
- Learn about HOLMES scoring: [docs/architecture/holmes-architecture.md](../architecture/holmes-architecture.md)

Database-specific generators and fixtures live in `wesley-postgres`. Legacy
certificate and HOLMES commands remain compatibility or assurance surfaces, not
the native compiler quick start.
