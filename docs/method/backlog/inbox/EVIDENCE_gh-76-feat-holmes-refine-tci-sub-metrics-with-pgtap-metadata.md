# GH-76 feat(holmes): refine TCI sub-metrics with pgTAP metadata

- Imported from: GitHub issue
- Issue: #76
- URL: https://github.com/flyingrobots/wesley/issues/76
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:31Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `holmes`, `scoring`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary\nTCI now exposes sub-metrics (unitConstraints, rls, integrationRelations, e2eOps) in scores.breakdown, but the calculation still derives coverage heuristically from evidenceMap suffixes. We should refine these metrics using richer pgTAP metadata so HOLMES highlights test depth more accurately.\n\n## Context\n- Scores v2 (bundleVersion 2.0.0) now lands in main with granular breakdowns.\n- Current implementation infers coverage by checking for evidenceMap footprints like `col:User.email.unique` or migration UIDs.\n- PgTAP generator already knows which suite emits each test (structure, constraint, default, index, RLS, migration).\n\n## Tasks\n- Emit structured suite metadata (e.g., section identifiers, assertions) from PgTAP generator alongside evidenceMap entries.\n- Update ScoringEngine.calculateTCIBreakdown to consume that metadata instead of heuristics.\n- Adjust Watson recalculation/Wesley history writer if additional fields are needed.\n- Extend unit tests + holmes-e2e to assert refined scores, and document the guidance in docs/architecture/holmes-integration.md.\n\n## Acceptance\n- TCI sub-metrics reflect actual pgTAP coverage counts, not inferred heuristics.\n- No regressions in HOLMES CLI or dashboard validation.],workdir:.,timeout_ms:120000}
