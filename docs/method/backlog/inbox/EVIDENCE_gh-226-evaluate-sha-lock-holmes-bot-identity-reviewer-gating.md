# GH-226 Evaluate "SHA-lock HOLMES" bot identity + reviewer gating

- Imported from: GitHub issue
- Issue: #226
- URL: https://github.com/flyingrobots/wesley/issues/226
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:49Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `security`, `ci`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: Evaluate "SHA-lock HOLMES" bot identity + reviewer gating

## Overview

Investigate posting PR comments from a dedicated bot account (e.g., `@sha-lock-holmes` via PAT or GitHub App) and optionally acting as a reviewer that can request changes when scores fall below thresholds, integrating with branch protections.

## Acceptance Criteria

- [ ] Decide on auth mechanism (fine-grained PAT vs GitHub App) and required scopes.
- [ ] Prototype posting comment as the bot and (optionally) requesting changes via Reviews API.
- [ ] Document operational model (token rotation, membership, permissions) and risks.

## Definition of Done

- Tests / validation: Trial run on a test PR showing a comment authored by the bot; if gating is enabled, verify protected-branch behavior.
- Docs / comms touched: Add an operator’s guide for bot setup and maintenance.

## Links

- Primary reference: .github/workflows/wesley-holmes.yml comment step
- Related issues / PRs: #214, #55, #192
