# GH-448 feat(evidence): make certified HOLMES/WATSON citations exact-span and digest-backed

- Imported from: GitHub issue
- Issue: #448
- URL: https://github.com/flyingrobots/wesley/issues/448
- Imported on: 2026-04-04
- GitHub updated: 2026-03-24T23:53:19Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `holmes`, `work:product`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Work Type

product

## Sponsor Actor

Reviewer deciding whether a certified change is trustworthy, and the agent surfaces that need machine-verifiable evidence instead of broad citations.

## Hill

A reviewer can trust a certified HOLMES/WATSON result because every certified claim resolves to exact source and artifact spans with stable digests.

## Playback

Run a cert flow on a representative schema change, inspect the certified HOLMES/WATSON output, and verify that every cited claim points to exact source spans, exact artifact spans, and stable digests with no coarse fallback surviving certification.

## Problem

Certified evidence is still too coarse in important paths. That weakens reviewer trust, makes automated verification less precise, and leaves Phase 3 only partially complete.

## Proposed Change

Replace the remaining coarse placeholder citations in certified HOLMES/WATSON flows with exact source spans, exact artifact spans, and digest-linked claims so certification output is precise and machine-verifiable.

## Invariants To Preserve

- ledger remains runtime truth
- certification remains replay-safe
- evidence paths remain deterministic and machine-readable
- docs and runtime must agree on what certification actually guarantees

## Non-Goals

- redesign HOLMES/WATSON scoring philosophy
- add new directive semantics
- broaden certification scope beyond exact evidence truth for the existing paths

## Acceptance / Tests

- [ ] Certified bundles contain exact source spans for certified claims.
- [ ] Certified bundles contain exact artifact spans for certified claims.
- [ ] Certified claims are linked to stable source and artifact digests.
- [ ] Placeholder broad-span citations no longer survive certification.
- [ ] Regression coverage proves the certification path fails if exact citation requirements regress.
