# Wesley Implementation Status Report
Updated: 2025-10-07 — reflects current main after QIR SQL lowering + emission (PRs #42, #44) and repo/docs hygiene (#43, #45). The original “drift” was a product pivot from D.A.T.A. to Wesley; this report now tracks real implementation status.

## PROGRESS

```bash
███████░░░ 65% ~= 39/60

39 ≈ count(✅ completed + - [x]), 60 = total tracked tasks (see go-public-checklist.md)
```

## Executive Summary

**Overall Implementation Score: 65/100 (MVP SHAPING UP)**

Wesley is a schema‑first data layer compiler that generates PostgreSQL, TypeScript, Zod, pgTAP tests, and RLS from GraphQL. The earlier “drift” was a pivot, not decay. We now have stable CI, a pure core, working generators, and an experimental QIR path (lowering + emission) behind `--ops`.

**Current Status:** Core generators and tests are in place; CI is green and cost‑conscious; QIR lowering/emission is merged. Remaining: CLI wiring for `--ops`, a minimal op→QIR translator, and public‑readiness polish tracked in go-public-checklist.md.

## Readiness Matrix (snapshot)

| Area                          | Readiness | Notes |
|-------------------------------|-----------|-------|
| Core domain (Schema/Events)   | 80%       | Stable models; minor use-case polish |
| Generators (DDL/Zod/TS/RLS)   | 80%       | Rich directive coverage + snapshots |
| pgTAP generation              | 75%       | Suites emitted; expand coverage over time |
| QIR: Nodes/Params/Predicates  | 90%       | Deterministic traversal semantics |
| QIR: Lowering + Emission      | 85%       | SELECT/JOIN/LATERAL/order/limit; VIEW+SQL fn |
| QIR: op→QIR translator        | 30%       | Pending: map GraphQL ops to plans |
| CLI (generate/plan/rehearse)  | 75%       | Adapterized; `--ops` wiring pending |
| HOLMES/WATSON/MORIARTY        | 60%       | Hardened workflow; gating off by default |
| CI/Workflows                  | 85%       | Ubuntu-only; boundaries stable; artifacts robust |
| Docs/OSS hygiene              | 80%       | Guides + PR template + CODEOWNERS; checklist added |

## ✅ Resolved Issues (Previously Critical)

### ~~1. Major Documentation Mismatch~~ **FIXED**
- **Root Cause**: Wesley pivoted from D.A.T.A. project
- **Resolution**: Updated CLAUDE.md and removed all D.A.T.A. references
- **Status**: ✅ Documentation now correctly describes Wesley as Data Layer Compiler

### ~~2. Missing Platform Adapter Implementation~~ **FIXED**
- **Issue**: CLI couldn't import from @wesley/host-node
- **Resolution**: Created index.mjs with proper exports
- **Status**: ✅ CLI now runs successfully

### ~~3. Build System Completely Broken~~ **FIXED**
  
### 4. CI instability and cost overruns — FIXED
- Removed macOS runners to control spend; Ubuntu‑only matrices retained
- Stabilized Architecture Boundaries workflow (dep‑cruise + ESLint purity + lightweight node:* smoke)
- Removed failing Claude Code Review workflow; guarded remaining optional Claude jobs

### 5. Evidence/HOLMES flakiness — FIXED
- HOLMES workflow hardened: tolerates missing bundle by regenerating; aligns out dirs; artifacts uploaded consistently
- **Issue**: Package linking and exports were broken
- **Resolution**: Fixed exports, added pnpm-lock.yaml
- **Status**: ✅ Can run `node packages/wesley-cli/wesley.mjs`

## 🚧 Current Implementation Gaps

### 1. Generator Implementation (Score: 75/100)

**What Works:**
- ✅ PostgreSQL DDL generator with rich directive coverage (snapshots included)
- ✅ Zod and TypeScript generators (snapshot tests in place)
- ✅ RLS policy emission (minimal + presets) and pgTAP generation
- ✅ QIR: Nodes, ParamCollector (deterministic), PredicateCompiler, SQL lowering (lists/NULL/IN/ANY/tie‑breakers), and emission (VIEW + SQL function returning jsonb)

**What’s Pending / Next:**
- [ ] Minimal op→QIR translator (from GraphQL ops to QIR plans) for `--ops`
- [ ] Deterministic ORDER BY via actual PK/unique metadata (replace heuristic `<alias>.id`)
- [ ] Optional RETURNS TABLE(...) signatures for SQL functions

### 2. Architecture Alignment (Score: 85/100)

**What's Good:**
- ✅ Hexagonal boundaries enforced in CI (dep‑cruise + ESLint purity)
- ✅ Clear package separation (core/host‑node/cli)
- ✅ Pure core (no node:*); adapterization complete for CLI paths used

**Issues:**
- [ ] Sweep remaining CLI utilities for any lingering host imports
- [ ] Keep boundary job lean (prefer tool‑based checks over greps)

## Detailed Implementation Status

### Core Package (~80% complete)
- ✅ Domain models (Schema, Table, Field)
- ✅ Generators: PostgreSQL, Zod, TypeScript, RLS; pgTAP suites
- ✅ QIR: Nodes, ParamCollector, PredicateCompiler, Lowering, Emission
- ✅ Evidence scaffolding and internal artifacts
- [ ] QIR: op→QIR translator (pending)
- [ ] ORDER BY tie‑breaker via real PK/unique metadata

### Host-Node Package (~70% complete)
- ✅ File system + path adapters; shell adapter; stable entrypoint (`wesley.mjs`)
- ✅ Fallback import resilience for CLI resolution
- ✅ Works in CI workflows; supports generate/plan/rehearse/cert
- [ ] op→QIR CLI wiring for `--ops`

### CLI Package (~75% complete)
- ✅ Commands: generate, plan, rehearse, up, cert‑*, validate‑bundle
- ✅ Cost‑aware tests (Ubuntu only), quick CLI + E2E
- [ ] `--ops` wire‑up (compile ops → QIR → SQL emission)
- [ ] Optional watch for ops once wired

### HOLMES/WATSON/MORIARTY (~60% complete)
- ✅ CLI exists and runs in CI; investigation/verification/prediction steps produce artifacts
- ✅ Workflow hardened (artifact fallback, upload)
- [ ] Stabilize gating and thresholds; make blocking only when artifacts are guaranteed

## Root Cause Analysis

### Primary Issue: Remaining Productization
Core capabilities are implemented; remaining work is wiring, polish, and public‑readiness. The experimental QIR path needs a minimal translator and CLI exposure behind `--ops`.

### Secondary Issue: Experimental QIR
Lowering + emission are merged; the translator and examples must be added before recommending `--ops` broadly.

### Not Issues Anymore:
- ✅ Documentation mismatch (fixed - was due to pivot)
- ✅ Package exports (fixed)
- ✅ CLI execution (fixed)

## Recommended Actions

### Action Plan — Tracked in go-public-checklist.md
Use go-public-checklist.md as the living source of tasks. Highlights:

Immediate
- [ ] README polish (+ QIR note), Compatibility section
- [ ] Required checks + branch protection for main
- [ ] Guard/remove remaining Claude workflows

Short Term
- [ ] `--ops` CLI wiring + op→QIR translator
- [ ] Example ops + EXPLAIN JSON snapshots
- [ ] pgTAP smoke for ops emission

Medium Term
- [ ] ORDER BY tie‑breaker via real PK/unique keys
- [ ] Optional RETURNS TABLE(...) for functions
- [ ] Docs site or enriched guides

## Success Metrics

To reach **90/100 (PRODUCTION READY)**:

- [x] Package Linking: ✅ imports resolve; CLI and workflows run
- [x] Documentation Accuracy: ✅ docs reflect Wesley (README/docs/guide)
- [ ] Generator Completeness → 90: QIR translator + ops wiring; RETURNS TABLE option
- [ ] Architecture Alignment → 90: final adapterization sweep, boundary job hygiene
- [ ] Test Coverage → 80: op emission pgTAP + EXPLAIN JSON snapshots + property tests

## Conclusion

Wesley is not “broken” or suffering from drift — it **successfully pivoted from D.A.T.A.** The foundation is solid:
- ✅ Clear vision as Data Layer Compiler
- ✅ Good architectural design
- ✅ CLI runs after our fixes
- ✅ Documentation now accurate

**Next Priority:** Wire `--ops` end‑to‑end (op→QIR→SQL), add examples and tests, and complete public‑readiness tasks in go-public-checklist.md.

The project is in much better shape than the original "drift" analysis suggested. It just needs its core compilation features to be implemented.

---
*Report reflects current main through 2025‑10‑07 — Pivot complete; now shipping the MVP.*
