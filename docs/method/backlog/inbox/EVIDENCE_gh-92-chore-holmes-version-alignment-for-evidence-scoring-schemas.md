# GH-92 chore(holmes): version alignment for evidence + scoring schemas

- Imported from: GitHub issue
- Issue: #92
- URL: https://github.com/flyingrobots/wesley/issues/92
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:39Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `pkg:wesley-core`, `pkg:wesley-host-node`, `group:holmes-scoring`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary
Keep evidence-map and scoring schema versions in lockstep and document migration notes so downstream tools can reject incompatible bundles.\n\n## Details\n- When bumping bundleVersion, also bump evidence-map version (or vice versa) with explicit mapping.\n- Persist version compatibility info in bundle.json (e.g., `schemaVersions: { evidence: X, scores: Y }`).\n- Update validate-bundle to enforce expected combinations.\n- Add release notes / docs snippet describing versioning policy.\n\n## Motivation\n- As scoring schema evolves, mismatched evidence maps can slip through, causing runtime errors or silent misreads.\n\n## Acceptance Criteria\n- Bundle files publish both evidence + score schema versions.\n- validate-bundle fails when versions are incompatible.\n- Documentation describes how version bumps are coordinated.
