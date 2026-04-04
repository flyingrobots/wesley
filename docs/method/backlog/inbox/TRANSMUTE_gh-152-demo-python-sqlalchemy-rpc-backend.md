# GH-152 demo(python-sqlalchemy): RPC backend

- Imported from: GitHub issue
- Issue: #152
- URL: https://github.com/flyingrobots/wesley/issues/152
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:51Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:future-generators`, `group:demos`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Align with SQLAlchemy generator issue (#144).

# [DEMO-152] demo(python-sqlalchemy): RPC backend

## Overview

Create a Python demo (FastAPI/Flask) using Wesley-generated SQLAlchemy models to demonstrate RPC workflows end-to-end.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #144 (SQLAlchemy generator)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: demos directory conventions

## User Story

As a **Python developer**, I want **a Wesley SQLAlchemy RPC demo**, so that **I can see how generated models integrate with a Python service**.

## Acceptance Criteria

- [ ] FastAPI/Flask example wired to generated models/migrations.
- [ ] RPC endpoints or tasks showcasing Wesley integration.
- [ ] README with setup/run instructions.
- [ ] Optional script to regenerate artifacts.

## Definition of Done

Demo added with docs, optional smoke instructions, and references to generator.

## Scope

### In-Scope

- Python service scaffolding
- Integration with generated models
- Documentation

### Out-of-Scope

- Production deployment or auth flows

### Deliverables

- **Est. Lines of Code:** 500-700 (demo + docs)
- **Est. Blast Radius:** demos/python-sqlalchemy, docs

## Implementation Details

### High-Level Approach

Generate SQLAlchemy models, create FastAPI/Flask app using them, expose RPC endpoints, document usage.

### Affected Areas

- demos/python-sqlalchemy
- docs/demos

### Implementation Steps

- [ ] Generate models using Wesley.
- [ ] Scaffold FastAPI/Flask app.
- [ ] Implement sample RPC route(s).
- [ ] Document setup and usage.

## Test Plan

### Happy Path

- [ ] Demo runs locally; sample requests succeed.

### Edge Cases

- [ ] Document environment variables (DB DSN).

### Failure Cases

- [ ] Provide troubleshooting for pip/venv issues.

### Monitoring & Success Metrics

- [ ] Optional future CI job to build demo.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local Python env | Demo app | TBD | pending | |

## Requirements

### Hard Requirements

- Keep dependencies minimal; Python 3.11+.

### Soft Requirements

- Provide curl/Postman examples.

### Runtime Requirements

- Works with Postgres DSN (matching generator).

### Dependencies & Approvals

- [ ] SQLAlchemy generator (#144).

---

## Production Notes

### Priority: 2 / 5

Demo for future generator adoption.

### Complexity: 4 / 5

Backend scaffolding + docs.

### Estimate: 60 - 80 hours

Includes implementation and docs.

### Risk & Rollback

- **Primary Risks:** Demo rot.
- **Mitigations:** Document maintenance, mark as experimental.
- **Rollback / Kill Switch:** Archive demo if unmaintained.
