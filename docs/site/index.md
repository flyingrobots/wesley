---
title: Wesley Overview
---

<!-- docs-truth: status=experimental owner=@flyingrobots -->

# Wesley

Wesley is the domain-free GraphQL-to-IR compiler and assurance toolchain.
Provide a GraphQL SDL input and the tooling owns:

- GraphQL parsing, canonicalization, lowering, and evidence plumbing
- Generic transmutation and module contracts
- Rust and TypeScript command surfaces for generic artifacts
- Evidence bundles and HOLMES scoring for release gates

📄 Read the [project README](../README.md) for the full story.

🧭 The [delivery lifecycle](../architecture/lifecycle.md) explains how
Transform → Plan → Rehearse → Ship fit together.

📅 Current direction lives in the [roadmap](roadmap.md) and
[BEARING](../BEARING.md).

## Quick facts

- **Input:** GraphQL SDL
- **Outputs:** deterministic IR, generic projections, and evidence artifacts
- **Runtime:** Native Rust CLI plus retained JavaScript support tooling
- **License:** Apache-2.0 (see `LICENSE`)
- **Source:** [github.com/flyingrobots/wesley](https://github.com/flyingrobots/wesley)

## Getting started quickly

After the `v0.2.0` release publishes, install the CLI and run the local Quick
Start:

```bash
cargo install wesley-cli --version 0.2.0
wesley schema lower --schema schema.graphql --json
```

Database-specific generators and harnesses live in `wesley-postgres`.
