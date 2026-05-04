---
title: Wesley Overview
---
<!-- docs-truth: status=experimental owner=@flyingrobots -->

# Wesley

[![Browser Smoke](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml/badge.svg?branch=main)](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml)
[![Runtime Smokes](https://github.com/flyingrobots/wesley/actions/workflows/runtime-smokes.yml/badge.svg?branch=main)](https://github.com/flyingrobots/wesley/actions/workflows/runtime-smokes.yml)

Wesley is the generic GraphQL compiler and assurance kernel. Provide a GraphQL
SDL input and the tooling owns:

- GraphQL parsing, canonicalization, lowering, and evidence plumbing
- Generic transmutation and module contracts
- TypeScript + Zod command surfaces for generic artifacts
- Evidence bundles and HOLMES scoring for release gates

📄 Read the [project README](../README.md) for the full story.

🧭 The [delivery lifecycle](../architecture/lifecycle.md) explains how
Transform → Plan → Rehearse → Ship fit together.

📅 Current direction lives in the [roadmap](roadmap.md) and
[BEARING](../BEARING.md).

## Quick facts

- **Input:** GraphQL SDL with `@wes_*` directives
- **Outputs:** module-owned artifacts, TypeScript, Zod, evidence bundles
- **Runtime:** Node.js 18+ (CLI ships as ESM modules)
- **License:** MIND‑UCAL v1.0 (see `LICENSE`)
- **Source:** [github.com/flyingrobots/wesley](https://github.com/flyingrobots/wesley)

## Getting started quickly

Install the CLI and run the local Quick Start:

```bash
npm install -g @wesley/cli
wesley init
wesley generate --schema schema.graphql --transmutation null-generator --emit-bundle
wesley cert-create --out .wesley-cache/SHIPME.md
```

Database-specific generators and harnesses live in `wesley-postgres`.

## Runtime smokes

CI exercises multi-host support on every push/PR:

- Browser smoke harness (Vite + Playwright)
- Deno smoke script
- Bun smoke script
