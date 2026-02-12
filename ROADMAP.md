# Roadmap

> Single source of truth for remaining work.
> Completed milestones live in `CHANGELOG.md`.

---

## In Flight

### QIR Phase C

End-to-end `--ops` pipeline: compile GraphQL operations into QIR query plans.

- [x] CLI wiring: `--ops` path to compile and emit ops; write artifacts to `out/ops/`
- [x] Strict identifier quoting policy + reserved word detection
- [x] Parameter safety hardening (typed IN/LIKE/ILIKE/CONTAINS)
- [x] PK resolver for deterministic ORDER BY tie-breakers
- [x] Transactional ops deployment (`ops_deploy.sql`)
- [x] `--ops-security`, `--ops-search-path`, `--ops-explain mock` CLI flags
- [x] Ops registry (versioned, schema-validated) + manifest discovery
- [x] DISTINCT ON support in QIR lowering
- [x] Cursor encode/decode helpers for pagination
- [x] Ambiguous join ref diagnostics
- [x] JSON schemas: qir, ops-manifest, ops-registry, ir-envelope, plan-report, realm, shipme
- [x] QIR spec + IR Family spec (Mermaid diagrams) + expanded ops guide
- [ ] Translator: map GraphQL operations → QIR plans (selections, joins, filters, order, pagination, nested lists)
- [ ] pgTAP smoke tests for emitted ops (shape, filters, RLS where relevant)
- [ ] Real EXPLAIN snapshots (branch only has mock mode)

Tracking: [#160](https://github.com/flyingrobots/wesley/issues/160), [#159](https://github.com/flyingrobots/wesley/issues/159)

### Migration Planning (DDL Planner Phase B)

Extend the expand-only planner to cover the full lifecycle.

- [ ] Backfill/switch/contract SQL emission (per-phase files for rehearsal)
- [ ] Drift detection between live schema and Wesley-managed state
- [ ] `wesley plan --explain` coverage for new phases

### Docs IA Consolidation

- [ ] Finish IA reorganisation: Concepts / How-To / Reference / Internals / Roadmap
- [ ] Prune remaining dead links

---

## Next Up

### Go Public

Final polish before flipping the repository from private to public.

- [ ] README polish and contributor guide
- [ ] Required CI checks and branch protection hardening
- [ ] License and legal review

### Shadow REALM Core

`wesley shadow` lifecycle for safe migration rehearsal.

- [ ] Docker harness for ephemeral shadow databases
- [ ] Seed/mask pipeline for realistic test data
- [ ] Workload replay and smoke drills
- [ ] REALM verdicts feed into SHIPME certificates

---

## Future

| Milestone | Summary |
| --------- | ------- |
| HOLMES Scoring Enhancements | Structured metadata, provenance, dashboard improvements |
| Config & Init | `wesley.config` generation, env scaffolding, init wizard, watch mode |
| Supabase Platform | Storage, Realtime, Edge Function emission + CLI deploy scripts |
| Frontend Adapters | RPC scaffolding for Next.js, Vite/Express, Remix, SvelteKit, Astro, Nuxt |
| Multi-language Generators | Prisma, Drizzle, Nest TypeORM, SQLAlchemy, ActiveRecord, Go ent |
| DevOps & Docs Polish | Docker scaffolding, security/CI hardening, docs site refresh |

---

## Deferred (Echo)

These items are acknowledged but not scheduled. Echo milestones E0–E4 are complete;
the items below remain for future coordination.

| Item | Notes |
| ---- | ----- |
| SHA-256 → BLAKE3 migration | Wesley uses SHA-256; Echo SPEC-0008 specifies BLAKE3. Breaking change to hash chains — coordinated across both repos. |
| Cross-platform CI matrix | Linux/macOS/Windows + musl/glibc golden-vector verification. |
| `echo-ttd-gen` Rust crate | May be folded into `echo-wesley-gen` or created when TTD protocol stabilises. |
| Supabase/PG target for Echo | PG-backed storage for Echo schemas — speculative. |
