# GH-147 demo(nextjs): end-to-end RPC sample

- Imported from: GitHub issue
- Issue: #147
- URL: https://github.com/flyingrobots/wesley/issues/147
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:43Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`, `group:demos`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Depends on Next.js adapter issue #134.

# [DEMO-147] demo(nextjs): end-to-end RPC sample

## Overview

Build a Next.js app using the generated adapter to fetch data via Wesley RPC, validating the stack end-to-end.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #134 (Next.js adapter)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: demos directory, example schemas

## User Story

As a **Next.js developer**, I want **a working Wesley RPC demo**, so that **I can learn how to integrate the adapter quickly**.

## Acceptance Criteria

- [ ] Demo located under `demo/nextjs-rpc` (or similar) with README.
- [ ] Example schema/config generates adapter outputs used by app.
- [ ] Page/API route fetches data via Wesley RPC.
- [ ] CI smoke test runs transform + `pnpm dev` (headless check) or documented manual steps.

## Definition of Done

Demo committed with documentation, optional smoke test or instructions, and references to adapter issue.

## Scope

### In-Scope

- Next.js project scaffolding
- Adapter integration
- Documentation + optional smoke test

### Out-of-Scope

- Production-grade features (auth, caching)

### Deliverables

- **Est. Lines of Code:** 500-700
- **Est. Blast Radius:** demos/nextjs, docs, CI workflow (if smoke test added)

## Implementation Details

### High-Level Approach

Generate adapter artifacts, integrate within Next.js app (API route/getServerSideProps), provide sample page and instructions, optionally add headless request test.

### Affected Areas

- demos/nextjs/
- docs/demos
- CI workflow (optional)

### Implementation Steps

- [ ] Scaffold Next.js app and integrate adapter outputs.
- [ ] Create sample page calling RPC.
- [ ] Document setup (transform → plan → rehearse → pnpm dev).
- [ ] Add optional smoke test (headless request) in CI.

## Test Plan

### Happy Path

- [ ] Demo runs locally; page returns data.

### Edge Cases

- [ ] Document environment variables (DB DSN).

### Failure Cases

- [ ] Provide troubleshooting for pnpm/Next.js issues.

### Monitoring & Success Metrics

- [ ] Optional CI job ensures demo stays healthy.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local Node env | Demo app | TBD | pending | |
| CI (optional) | Headless request | TBD | pending | |

## Requirements

### Hard Requirements

- Next.js 14+ compatibility.

### Soft Requirements

- Include screenshot/GIF in README.

### Runtime Requirements

- Works with Postgres DSN.

### Dependencies & Approvals

- [ ] Next.js adapter (#134) delivered.

---

## Production Notes

### Priority: 2 / 5

Supports adapter adoption.

### Complexity: 4 / 5

Full-stack demo plus optional CI.

### Estimate: 60 - 80 hours

Includes build, docs, optional tests.

### Risk & Rollback

- **Primary Risks:** Demo maintenance, CI flakiness.
- **Mitigations:** Keep dependencies minimal, mark as example.
- **Rollback / Kill Switch:** Archive demo if unmaintained.
