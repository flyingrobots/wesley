# GH-247 RFC: Wesley Playground — In‑Browser End‑to‑End Demo (Zero‑Install)

- Imported from: GitHub issue
- Issue: #247
- URL: https://github.com/flyingrobots/wesley/issues/247
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:34Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `rfc`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# RFC Submission: Wesley Playground — In‑Browser End‑to‑End Demo (Zero‑Install)

## Summary

Deliver a browser‑only “try it before you install” playground that compiles GraphQL → real Postgres DDL/RPC, runs HOLMES live, and simulates zero‑downtime migrations (SHADOW REALM) — all with no persistence, no backend.

## Authors & Roles

- **Primary Author(s):** @flyingrobots
- **Supporting Contributors:** @maintainers
- **Reviewers Needed From:** core, frontend, infra

## Motivation

- Lower the activation energy to experience Wesley’s value.
- Make docs interactive and prove “real PG artifacts + safe migrations” live.
- Foundation for shareable sessions and future connected demos.

## Goals

- In‑browser DDL apply with pg‑mem (no persistence).
- Optional WASM PG (beta) toggle.
- Live HOLMES scores + event timeline.
- Scenarios: DDL → RPC → migrations → zero‑downtime choreography.

## Non-Goals

- No SaaS backend in MVP; no persistent storage.
- Full extension support (uuid‑ossp, pgcrypto, trgm) in‑browser.

## Proposal Overview

- UI: editor + artifacts + engine selector + event timeline + HOLMES panel.
- Engines: pg‑mem default; WASM PG optional toggle.
- Realm: simulate phases; optional WASM apply with tiny data.
- Capability matrix in UI with honest limitations.

## Impact Assessment

| Area | Impact | Notes |
| --- | --- | --- |
| Users | High | Zero‑install demo accelerates adoption |
| Product | High | Interactive docs; marketing leverage |
| Engineering | Medium | Workers, wasm, capability gating |
| Go-to-market | High | Shareable link; conference demos |

## Dependencies

- #241, #242 engines; #243–#246 scenarios; #224 HOLMES UX

## Timeline (Rough Cut)

- **Discovery Complete:** 2025‑11‑01
- **Prototype / Spike:** 2025‑11‑07
- **Final Decision Target:** 2025‑11‑10

## Risks & Unknowns

- WASM size/startup; capability gaps; perf on low‑end devices.

## Requested Feedback

- Are the MVP scenarios sufficient to convey safety/end‑to‑end value?
- Is pg‑mem default + WASM toggle the right tradeoff?

## Appendices

- docs/drafts/playground-db-strategy.md
- docs/drafts/playground-demo-scenarios.md
