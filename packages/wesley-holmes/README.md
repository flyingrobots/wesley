# @wesley/holmes

Implements SHA-lock investigative tooling for Wesley deployments.

- **Holmes** – Inspects evidence bundles, computes scores, and produces machine-readable + markdown reports.
- **Watson** – Verifies evidence maps against expectations and surfaces human-friendly commentary.
- **Moriarty** – Generates predictions using historical deployment data.
- **CLI** – `packages/wesley-holmes/src/cli.mjs` exposes `investigate`, `verify`, and `predict` commands used in CI.

## Usage

```bash
pnpm --filter @wesley/holmes test           # Run the full HOLMES suite
pnpm --filter @wesley/holmes exec node src/cli.mjs investigate --help
```

Artifacts are persisted under `.wesley/` (e.g., `scores.json`, markdown reports) and consumed by the CI workflows.

## Status

Status: Active
![pkg-holmes](https://github.com/flyingrobots/wesley/actions/workflows/pkg-holmes.yml/badge.svg?branch=main)

Production ready; weighting configuration is extensible via `.wesley/weights.json`.
