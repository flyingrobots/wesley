# “Boring Deployment” isn’t naïve—it’s compiled

Yes, Wesley is a domain-specific compiler. That’s exactly how you make gnarly things boring: push the complexity into the tool and impose proof obligations on every change.

## What makes it boring in practice

- IR, not vibes: GraphQL → Wesley IR (tables, relations, policies, checks, functions). All generators (SQL, RLS, tests, migrations) consume the same IR. Deterministic in = deterministic out.
- Protocols, not files: Every change is compiled into the expand → backfill → validate → switch → contract protocol. No single-shot “yolo” DDL.
- Proof obligations: A change is “ready” only if:
- pgTAP suite passes (structure, constraints, RLS, perf hints)
- Shadow rehearsal passes (expand/backfill/validate timings & lock profile)
- Drift = 0 (schema ⇄ implementation)
- Risk budget not blown (e.g., no rewrites on hot tables)
- SHA-lock attestation sealed
- Escape hatches with alarms: Raw SQL blocks allowed, but must declare intent (--@unsafe, --@rewrite-ok) and carry their own tests. CI screams if you try to merge without the proofs.

## Why a compiler?

Because compilers make complexity boring. We encode the safe patterns once (NOT VALID → VALIDATE, CONCURRENTLY, shadow columns, view shims, phased RLS), generate tests to prove them, and refuse to ship when math disagrees with hope.

---

## Moriarty (time-to-prod): accuracy over astrology

The haters are right about naïve velocity. So we don’t do naïve.

### Model: features ≠ bugs ≠ chores

- Classification: Conventional Commits or PR labels → feat, fix, refactor, chore, security.
Separate EMAs per class; only feat impacts schema completion; fix/security impact readiness debt.
- Regime shifts: If ≥30% contributors change or release cadence shifts, reset half-life and lower confidence.
- Evidence-anchored, not LOC: Readiness pulls from proof artifacts, not commit counts:
- % expand/backfill validated on shadow DB
- % constraints validated (NOT VALID → VALIDATE)
- RLS policy coverage & negative tests
- Index creation CONCURRENTLY + plan usage checks
- pgTAP pass rate and missing critical tests
- Hot-table rewrite risk (catalog-aware)
- 90/90 problem: We only move “done” when contract phase rehearses clean. Until then, it’s 0→80% tops.

### Config sketch (already matches your stack)

```js
// wesley.config.mjs
export default {
  readiness: {
    weights: { structure: 0.2, constraints: 0.2, rls: 0.2, perf: 0.1, tests: 0.2, rehearsal: 0.3 },
    gates: { requireRehearsal: true, requirePgTap: true, maxRewriteMB: 16 }
  },
  moriarty: {
    classifyBy: 'conventional-commits',     // or 'labels'
    halfLifeDays: 10,
    regimeShiftAuthorDelta: 0.3,
    confidencePenaltyOnShift: 0.35,
    coldStartFloorConfidence: 0.4
  }
}
```

### Predictions you can fire people over

Moriarty doesn’t guess from commit counts. It reads evidence: pgTAP results, shadow rehearsals, validated constraints, RLS coverage, and risk class. It models feat vs fix separately, detects regime shifts, and prints an ETA with confidence and an error band. When reality changes, confidence drops. No sandbagging, no hero math.

---

## Answering you points directly

> “This is complex AF.”

Agree. That’s why humans shouldn’t do it manually. The complexity is codified once and proven on every change. Your team gets a boring deploy button; Wesley eats the sharp edges.

> “New features vs bug fixes ruin prediction.”

We classify work and weight their impact differently. Only features move schema-completeness; fixes & security move readiness/risk. ETAs are conditional (“if expand/backfill stays green, ETA X with Y% confidence”).

> “Team changes make history useless.”

We detect regime shifts (authors, cadence) → decay the EMA, lower confidence, and require a fresh rehearsal. The model adapts in days, not quarters.

> “90% done, 90% to go.”

Not possible by design. Progress is gated on contract rehearsals and validated constraints. Until the boring parts pass, the score doesn’t lie to you.

---

## Extra artillery you already have (or can land quickly)

- SHA-lock Quality Certificates: Signed JSON with migration set, lock timings, test hashes, catalog stats, and risk class. Posted to the PR. Green or it doesn’t merge.
- Risk classes: LOW (add column/index), MEDIUM (type widen, new FK), HIGH (rewrite/hot table). High requires explicit operator note.
- Drift report: Schema vs DB vs types vs Zod — single table showing any divergence with links to generators that must fix it.
- RLS sims: Wesley emits simulation fixtures (role, tenant_id, sample rows) and pgTAP that proves deny-by-default and each allow case.

---

## TL;DR

- We moved the problem from handwritten migrations to a checked protocol with tests and attestation.
- We don’t predict off vibes; we predict off proofs.
- If the proofs aren’t there, we don’t ship. That’s what “boring” means.

If someone still wants to debate, point them at a real PR: “Here’s the expand/backfill/validate plan Wesley emitted, the pgTAP proving it, the rehearsal timings, and the SHA-locked cert. Tell me what’s missing.”
