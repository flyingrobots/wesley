# @wesley/holmes

Status: Legacy compatibility assurance surface pending extraction or rebuild.

Implements SHA-lock investigative tooling for historical Wesley deployments.
This package is not part of the native compiler front door. It remains in the
repo while assurance, evidence, and judgment tooling get an explicit boundary
separate from Rust compiler authority.

- **Holmes** – Inspects evidence bundles, computes scores, and produces machine-readable + markdown reports.
- **Watson** – Verifies evidence maps against expectations and surfaces human-friendly commentary.
- **Moriarty** – Generates predictions using historical deployment data.
- **Entry points** – `holmes` remains the multi-tool CLI, while `moriarty` is a dedicated prediction entry point.
- **Runtime binding** – HOLMES/Moriarty read Holmes-family run ledger state through Holmes-local support modules copied out of the retired Node runtime package. They do not shell out to the `wesley` executable for run inspection.
- **Product profiles** – Product modules such as `continuum/wesley/profile` may define domain-specific Holmes/Watson/Moriarty behavior profiles while `@wesley/holmes` remains the shared execution engine.
- **Counterfactual providers** – Counterfactual analysis is selected from loaded `holmes.counterfactualProviders` module capabilities; `@wesley/holmes` does not ship a product-specific provider by default.
- **Command runs** – `holmes investigate|verify|report` and the standalone `moriarty` entry point emit their own command streams into the Holmes-local ledger without reviving the retired `wesley runs` command family.
- **Native run inspection** – `holmes runs status|inspect` exposes persisted Holmes-family command streams without requiring the `wesley` entry point as the operator shell.

## Usage

```bash
pnpm --filter @wesley/holmes test           # Run the full HOLMES suite
pnpm --filter @wesley/holmes exec node src/cli.mjs investigate --help
pnpm --filter @wesley/holmes exec node src/moriarty-cli.mjs --help
```

Generated artifacts are persisted under `.wesley-cache/` (for example `scores.json`, `history.json`, `SHIPME.md`, counterfactual summaries, and ledger state) and consumed by the CI workflows.

## Status

Status: Legacy compatibility
![pkg-holmes](https://github.com/flyingrobots/wesley/actions/workflows/pkg-holmes.yml/badge.svg?branch=main)

Useful assurance tooling; weighting configuration is extensible via
`wesley.weights.json`. Do not use this package as a reason to add compiler
semantics to the legacy Node surface.
