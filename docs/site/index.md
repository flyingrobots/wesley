---
title: Wesley Overview
---

# Wesley

[![Browser Smoke](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml/badge.svg?branch=main)](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml)
[![Runtime Smokes](https://github.com/flyingrobots/wesley/actions/workflows/runtime-smokes.yml/badge.svg?branch=main)](https://github.com/flyingrobots/wesley/actions/workflows/runtime-smokes.yml)

Wesley is the “schema-first” data layer for Postgres and Supabase. Provide a
GraphQL SDL input and the tooling generates:

- PostgreSQL DDL and phased migrations (Expand → Backfill → Validate → Switch → Contract)
- TypeScript + Zod models for applications
- RLS policies, Supabase helpers, and pgTAP tests
- Evidence bundles and HOLMES scoring for release gates

📄 Read the [project README](../README.md) for the full story.

🧭 The [delivery lifecycle](../architecture/lifecycle.md) explains how
Transform → Plan → Rehearse → Ship fit together.

📅 Current release status lives on the [roadmap](roadmap.md).

## Quick facts

- **Input:** GraphQL SDL with `@wes_*` directives
- **Outputs:** SQL, migrations, TypeScript, Zod, pgTAP, evidence bundles
- **Runtime:** Node.js 18+ (CLI ships as ESM modules)
- **License:** MIND‑UCAL v1.0 (see `LICENSE`)
- **Source:** [github.com/flyingrobots/wesley](https://github.com/flyingrobots/wesley)

## Getting started quickly

Install the CLI and run the local Quick Start:

```bash
npm install -g @wesley/cli
wesley init
wesley generate --schema schema.graphql --emit-bundle
wesley plan --schema schema.graphql --explain
wesley rehearse --schema schema.graphql --dry-run --json
```

For a richer walkthrough, run the [BLADE demo](../blade.md) which
scripts Transform → Plan → Rehearse → Certify on an example schema.

## Runtime smokes

CI exercises multi-host support on every push/PR:

- Browser smoke harness (Vite + Playwright)
- Deno smoke script
- Bun smoke script
