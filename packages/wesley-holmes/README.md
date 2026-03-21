# @wesley/holmes

Implements SHA-lock investigative tooling for Wesley deployments.

- **Holmes** – Inspects evidence bundles, computes scores, and produces machine-readable + markdown reports.
- **Watson** – Verifies evidence maps against expectations and surfaces human-friendly commentary.
- **Moriarty** – Generates predictions using historical deployment data.
- **Entry points** – `holmes` remains the multi-tool CLI, while `moriarty` is a dedicated prediction entry point.
- **Runtime binding** – HOLMES/Moriarty read the Wesley run ledger directly through shared core use cases plus the shared Node runtime adapter package. They do not shell out to the `wesley` executable for run inspection anymore.

## Usage

```bash
pnpm --filter @wesley/holmes test           # Run the full HOLMES suite
pnpm --filter @wesley/holmes exec node src/cli.mjs investigate --help
pnpm --filter @wesley/holmes exec node src/moriarty-cli.mjs --help
```

Generated artifacts are persisted under `.wesley-cache/` (for example `scores.json`, `history.json`, `SHIPME.md`, counterfactual summaries, and ledger state) and consumed by the CI workflows.

## Status

Status: Active
![pkg-holmes](https://github.com/flyingrobots/wesley/actions/workflows/pkg-holmes.yml/badge.svg?branch=main)

Production ready; weighting configuration is extensible via `wesley.weights.json`.
