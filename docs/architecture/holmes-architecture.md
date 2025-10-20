# SHA-lock HOLMES Architecture

## Package Overview

`@wesley/holmes` is a sidecar package that inspects the evidence bundle emitted by `wesley generate` and produces three complementary reports:

- **Holmes** performs the core investigation, weighting coverage evidence and surfacing security/test gates.
- **Watson** re-verifies the bundle contents independently, spot-checking git history, recalculating scores, and flagging inconsistencies.
- **Moriarty** analyzes score history to forecast future readiness.

These investigators are exposed programmatically through `packages/wesley-holmes/src/index.mjs`, and the CLI entrypoint now binds them together with Commander-powered commands in `src/cli.mjs`.

## Command-Line Interface

The CLI uses Commander to provide subcommands that wrap each investigator and a combined report:

- `holmes investigate [--json <file>]`
- `holmes verify [--json <file>]`
- `holmes predict [--json <file>]`
- `holmes report [--json <file>]`
- `holmes weights [--file <path>] [--json <file>]`

Each command loads the required `.wesley` artifacts (`bundle.json`, `history.json`, optional `weights.json`), validates the generated report structure, and optionally writes structured JSON alongside the human-readable Markdown output. Unknown commands automatically fall back to Commander’s help, which still prints the original banner, requirements list, and quote block.

## Holmes Investigator

Holmes consumes the bundle’s evidence map, scores, schema metadata, and weight configuration to build an investigation report:

1. **Initialization** – The constructor extracts the bundle SHA, evidence, score breakdowns, and resolves weight configuration from environment variables, filesystem overrides, or defaults. It also indexes schema directives so directive-specific weights can be applied. 
2. **Investigation Data** – `investigationData()` aggregates summary metadata, iterates through every UID in the evidence map to determine status, source citations, and deductions, and constructs “gate” verdicts for migration risk, test coverage, and sensitive field hygiene.
3. **Rendering** – `renderInvestigation()` assembles a Markdown report including executive summary, score breakdown tables, evidence table, gates, and final verdict signed by Holmes.
4. **Weighting Logic** – Helpers such as `inferWeight()`, `matchOverride()`, `matchDirective()`, and `matchSubstring()` determine each UID’s weight based on overrides, schema directives, substring heuristics, or defaults. Sensitive-field checks and gating heuristics add opinionated guardrails to the investigation.

## Watson Verifier

Watson independently replays Holmes’s claims:

- `verificationData()` timestamps the audit, iterates through every evidence citation to confirm on-disk or git-tracked content, recomputes schema coverage (SCS) using a simplified weighting heuristic, and collates logical inconsistencies between SCS/TCI/MRI scores or missing tests on sensitive fields.
- Git lookups run through `safeGitShow()` to tolerate missing repositories or absent commits without aborting the run.
- `renderVerification()` formats the medical-style report and surfaces whether discrepancies require further investigation.

## Moriarty Predictor

Moriarty performs trend analysis over `.wesley/history.json`:

- Historical points are normalized, then exponential moving averages (EMA) and slope calculations estimate recent and blended velocities.
- `predictionData()` flags plateaus/regressions, derives optimistic/realistic/pessimistic ETAs when velocity is sufficient, gauges confidence via variance, and runs lightweight pattern detectors (velocity cliffs, test lag).
- The Markdown report emphasizes the latest scores, velocity analysis, ETA table, detected patterns, and a sparkline-style history list.

## Report Schemas & Validation

Before printing, each CLI command validates the structured data against bespoke schemas defined in `report-schemas.mjs`. The validator supports required keys, primitive typing, nested objects/arrays, and emits explicit error messages if generated reports diverge from the contract. This guarantees downstream tooling can rely on consistent JSON layouts.

## Weight Configuration Resolution

`weight-config.mjs` normalizes weighting inputs from multiple sources:

- Environment variables `WESLEY_HOLMES_WEIGHTS` (inline JSON) and `WESLEY_HOLMES_WEIGHT_FILE` override defaults.
- `.wesley/weights.json` provides repository-specific tuning.
- The normalizer accepts both flat key/value weight maps and structured `default/substrings/directives/overrides` documents, coercing values to finite numbers and canonicalizing directive keys.

Holmes records the resolved source (defaults, env, or file path) alongside the investigation summary so operators can trace which policy shaped the report.
