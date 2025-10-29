# Wesley Deployment Certificate — PRODUCTION
> "Data Done Right." Signed by SHA-lock HOLMES. Cross-examined by Dr. Wat-SUM.

- Repo: acme-corp/billing-service
- Env: production  
- Git: main @ a7f3d91 (tag: v2.4.0)
- Targets: postgres, prisma, drizzle, typescript, zod, pgtap
- Window: 2025-09-05T21:02Z ± 4m (predicted TTP: 3m 12s)
- Risk: LOW (0.14) — Friday deploy approved ✅

### Specification Completion (HOLMES)
- IR Hash: `ir@8bc4f29`
- Spec Bundle: `spec@d1e7a82` (schema.graphql, wesley.config.ts)
- Artifacts:
  - SQL Plan: `sql@9f2c1b4` (3 steps, zero-lock plan)
  - Prisma: `prisma@e6d8a93`
  - Drizzle: `drizzle@b2f4c71`
  - Types/Zod: `types@5a9e3d8`
- Reproducibility: `repro@c7b1f26` (clean room rebuild = identical ✅)

### Drift & Safety (HOLMES)
- Live Introspection: `live@f4a8e15` (as of 2025-09-05T20:54Z)
- Drift Summary: none (0 diffs) ✅
- Lock Impact: all operations non-blocking (ADD COLUMN nullable, CREATE INDEX CONCURRENTLY)
- Rollback Plan: `rollback@a3d7c89` (auto-generated, rehearsed in Shadow Realm)

### Shadow Realm Verdict (HOLMES)
- Shadow Clone: `shadow@2025-09-05T20:31Z` (30min TTL, 10min prod traffic replay)
- Backfill Performance: max lock 142ms, p95 write +1.8%, p95 read +0.3%
- Migration Rehearsal: completed in 3m 12s (within 4m window)
- Rollback Rehearsal: completed in 47s (under 60s SLA)
- Traffic Simulation: 0 errors, 0 constraint violations, 0 RLS policy failures ✅

### Test & Evidence (Dr. Wat-SUM)
- pgTAP: 184 tests (184 pass) ✅
- Integration: 62 (62 pass) ✅  
- RLS/Policy: 41 policy probes (41 pass) ✅
- Perf Probes: p95 write +1.8%, p95 read +0.3% (budget <3%) ✅
- Coverage: table/column policy coverage 100%, trigger coverage 98% ✅
- Evidence Pack: `evidence@7e9f4a2`

### Migration Plan Detail
```sql
-- Step 1: ADD COLUMN (non-blocking)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date timestamptz;

-- Step 2: BACKFILL (batched, 1000 rows/batch)
UPDATE invoices SET due_date = created_at + interval '30 days' 
WHERE due_date IS NULL;

-- Step 3: ADD NOT NULL (after backfill complete)
ALTER TABLE invoices ALTER COLUMN due_date SET NOT NULL;
```

### Approvals
- Owner: @daniel-dev (required) ✅
- Tech Lead: @sarah-arch (required) ✅
- Change Control: CAB-2025-09-05-F (auto-attached) ✅
- SHA-lock HOLMES: ✅ (signed 2025-09-05T20:57Z)
- Dr. Wat-SUM: ✅ (signed 2025-09-05T20:58Z)

---

```jsonc
{
  "version": "1.0",
  "certificate_id": "cert_production_2025-09-05T205930Z_a7f3d91",
  "repo": "acme-corp/billing-service",
  "env": "production",
  "git": { 
    "sha": "a7f3d91", 
    "tag": "v2.4.0", 
    "branch": "main", 
    "dirty": false,
    "author": "Daniel <daniel@acme-corp.com>",
    "message": "feat: add invoice due_date field for collections workflow"
  },
  "targets": ["postgres","prisma","drizzle","typescript","zod","pgtap"],
  "artifacts": {
    "ir": "ir@8bc4f29",
    "spec": "spec@d1e7a82", 
    "sql": "sql@9f2c1b4",
    "prisma": "prisma@e6d8a93",
    "drizzle": "drizzle@b2f4c71",
    "types": "types@5a9e3d8",
    "rollback": "rollback@a3d7c89",
    "evidence": "evidence@7e9f4a2",
    "shadow": "shadow@2025-09-05T20:31Z"
  },
  "drift": { "status": "none", "diffs": [] },
  "shadow_realm": {
    "clone_id": "shadow_prod_20250905_203145",
    "traffic_replay_minutes": 10,
    "backfill_max_lock_ms": 142,
    "migration_time_actual_sec": 192,
    "rollback_time_actual_sec": 47,
    "errors": 0,
    "constraint_violations": 0,
    "rls_policy_failures": 0,
    "verdict": "PASS"
  },
  "tests": {
    "pgtap": { "total": 184, "passed": 184 },
    "integration": { "total": 62, "passed": 62 },
    "policy": { "total": 41, "passed": 41, "coverage": 1.0 },
    "perf": { 
      "p95_write_delta": 0.018, 
      "p95_read_delta": 0.003, 
      "budget": 0.03,
      "backfill_impact_ms": 142
    }
  },
  "risk": { 
    "level": "LOW", 
    "score": 0.14,
    "factors": {
      "migration_kinds": ["ADD_COLUMN", "ALTER_COLUMN_NOT_NULL"],
      "table_size": "medium", 
      "recent_incidents": 0,
      "lock_history": "low",
      "friday_deployment": true
    }
  },
  "prediction": {
    "time_to_prod_sec": 192,
    "window_sec": 240,
    "method": "shadow_rehearsal_actual@2025-09-05",
    "confidence": 0.94,
    "based_on": "shadow_realm_execution"
  },
  "signatures": [
    {
      "signer": "SHA-lock HOLMES",
      "key_id": "holmes-ed25519-prod-01",
      "alg": "ed25519", 
      "signed_at": "2025-09-05T20:57:23Z",
      "sig": "mH7K9pQvN8xL2wE4rF6dA1sG3hJ5cM0nB9kY8vT2qP4eX7oI1uZ6aS3fD0gH5jL8wR9tE2qA4sF7dG0hJ3kM6nB=="
    },
    {
      "signer": "Dr. Wat-SUM", 
      "key_id": "wat-ed25519-prod-02",
      "alg": "ed25519",
      "signed_at": "2025-09-05T20:58:17Z", 
      "sig": "pL8N5eRvT2yX6wQ9rK3dF7sJ0hM4nC8vB5kZ1wE2qS7eY4oL9uA6aD3fG0hN5jX8wT9rE2qF4sG7dH0jM3kP6nC=="
    }
  ],
  "expires_at": "2025-09-06T20:59Z",
  "policy": {
    "require_signers": ["SHA-lock HOLMES","Dr. Wat-SUM"],
    "max_risk": 0.34,
    "max_ttp_window_sec": 900,
    "allow_friday": true,
    "require_shadow_realm": true,
    "max_backfill_lock_ms": 500
  },
  "deployment": {
    "approved_by": ["daniel-dev", "sarah-arch"],
    "scheduled_for": "2025-09-05T21:02Z",
    "change_control_id": "CAB-2025-09-05-F",
    "friday_deployment_authorized": true,
    "shadow_realm_rehearsed": true
  }
}
```

> **Rule:** `wesley deploy --env production` MUST refuse if `SHIPIT.md` is missing, expired, unsigned/invalid, or policy thresholds are exceeded.

**Certificate Status:** ✅ VALID FOR DEPLOYMENT  
**Friday Authorization:** ✅ APPROVED BY SHADOW REALM REHEARSAL  
**Deployment Window:** 4m 58s remaining (expires 21:02Z)

---

*This certificate was generated at 4:58 PM on Friday, September 5th, 2025.*  
*Daniel's weekend is cryptographically guaranteed to be peaceful.*  
*The door is open. The shape is made so.*