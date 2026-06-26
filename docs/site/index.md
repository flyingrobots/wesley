---
title: Wesley Overview
---

<!-- docs-truth: status=experimental owner=@flyingrobots -->

# Wesley

Wesley is the generic GraphQL compiler and assurance kernel. Provide a GraphQL
SDL input and the tooling owns:

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

- **Input:** GraphQL SDL with `@wes_*` directives
- **Outputs:** module-owned artifacts, TypeScript, Zod, evidence bundles
- **Runtime:** Native Rust CLI plus retained JavaScript support tooling
- **License:** MIND‑UCAL v1.0 (see `LICENSE`)
- **Source:** [github.com/flyingrobots/wesley](https://github.com/flyingrobots/wesley)

## Getting started quickly

Install the CLI and run the local Quick Start:

```bash
cargo install wesley-cli --version 0.1.0
wesley schema lower --schema schema.graphql --json
```

Database-specific generators and harnesses live in `wesley-postgres`.
