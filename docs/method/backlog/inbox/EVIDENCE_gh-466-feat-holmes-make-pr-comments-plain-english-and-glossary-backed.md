# GH-466 feat(holmes): make PR comments plain-English and glossary-backed

- Imported from: GitHub issue
- Issue: #466
- URL: https://github.com/flyingrobots/wesley/issues/466
- Imported on: 2026-04-04
- GitHub updated: 2026-03-30T11:07:26Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `holmes`, `work:product`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Sponsor actor
A pull-request reviewer who needs to decide whether a change is safe to merge without already knowing Wesley/HOLMES jargon.

## Hill
A reviewer can read the HOLMES GitHub comment and understand the ship recommendation, the top reasons, the next actions, and the jargon from the comment alone.

## Playback
Open a PR with a HOLMES comment and understand, without opening source code or docs:
- safe / investigate / do not ship
- why
- what to do next
- what SCS / TCI / MRI / evidence trust mean

## Type
product

## Invariants
- keep the underlying report truthful
- do not hide failing gates or weak evidence
- keep the GitHub comment machine-generated and reproducible
- do not break existing JSON report contracts

## Non-goals
- redesign the CLI markdown report wholesale
- remove the Holmes/Watson/Moriarty flavor
- change SHIPME or certificate policy

## Acceptance
- the PR comment starts with a plain-English summary
- the visible summary avoids unexplained acronyms
- the comment includes actionable next steps
- a collapsed glossary defines the major HOLMES terms
- tests cover the comment-builder behavior
