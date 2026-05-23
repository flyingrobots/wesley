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

## 2. Generate artifacts

Compile the example schema through the default generic transmutation:

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema test/fixtures/examples/ecommerce.graphql \
  --transmutation null-generator \
  --emit-bundle \
  --out-dir out/examples
```

## 3. Inspect generated evidence

```bash
node packages/wesley-host-node/bin/wesley.mjs cert-create \
  --out .wesley-cache/SHIPME.md
```

## 4. Verify the certificate

```bash
node packages/wesley-host-node/bin/wesley.mjs cert-verify \
  --in .wesley-cache/SHIPME.md
```

This verifies the generic assurance certificate emitted from the local run.

## 5. Next steps

- Explore direction: [docs/BEARING.md](../BEARING.md)
- Read the direction map: [Roadmap](./roadmap.md)
- Learn about HOLMES scoring: [docs/architecture/holmes-architecture.md](../architecture/holmes-architecture.md)

Database-specific generators and fixtures live in `wesley-postgres`.
