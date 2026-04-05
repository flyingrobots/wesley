# GH-311 holmes(ops): add ops coverage to evidence/scores (2–3h)

- Imported from: GitHub issue
- Issue: #311
- URL: https://github.com/flyingrobots/wesley/issues/311
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:38:57Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `holmes`, `scoring`, `group:qir-phase-c`, `work:product`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Work Type
`product`

## Hill Supported
HOLMES and related reports can explain ops proof coverage using real ops evidence instead of treating generated ops as invisible to scoring.

## Sponsor Actor
- Reviewer reading Holmes evidence and score outputs
- Maintainer trying to understand whether ops generation is actually covered by proof

## Playback
A maintainer runs the ops-enabled pipeline and Holmes or bundle outputs surface an ops coverage section backed by real evidence such as explain and pgTAP results.

## Problem
Ops artifacts now exist in the pipeline, but Holmes scoring and evidence summaries do not yet treat ops proof as a first-class scored/evidenced surface.

## Proposed Change
- add ops coverage signals to evidence and score outputs
- connect ops explain and ops pgTAP results into the Holmes-facing evidence model
- document the new ops coverage surface

## Invariants
- scoring stays evidence-backed, not hand-waved
- ops coverage reflects real proof artifacts instead of file existence alone
- docs and report output agree on what counts as ops evidence

## Non-Goals
- inventing fake ops scores before the proof lanes exist
- redesigning all Holmes scoring dimensions in one slice
- counting mock EXPLAIN artifacts as equivalent to real executed proof

## Acceptance / Tests
- evidence or score outputs show an ops coverage section
- docs explain the ops evidence story
- tests protect the new ops coverage behavior
