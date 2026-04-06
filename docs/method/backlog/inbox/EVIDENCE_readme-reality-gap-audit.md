# README Reality Gap Audit

- Lane: `inbox`
- Legend: `EVIDENCE`

## Why now

The previous root `README.md` carried a much larger public product story than
the repo can prove cleanly today. The signpost refresh made the front door more
honest, but that honesty creates a risk: we could quietly lose track of the
product promises, operator surfaces, and aspirational breadth the older README
was trying to point toward.

This note records the main gaps explicitly and links each one to a backlog item
so the repo can either prove the claim, narrow it, or retire it on purpose.

## Gaps

1. `production-ready` / `battle-tested` database-change claims outran the
   repo's current experimental status and incomplete end-to-end proof surface.
   See
   [EVIDENCE_database-lane-readiness-contract.md](./EVIDENCE_database-lane-readiness-contract.md).
2. The old README advertised a public operator flow that included
   `wesley certify` and `wesley deploy`, but today's CLI surface exposes
   `cert-create`, `cert-verify`, `cert-badge`, and `blade` instead.
   See
   [RUNTIME_boring-database-operator-surface.md](./RUNTIME_boring-database-operator-surface.md).
3. The old README claimed zero-downtime safety by default, while the roadmap
   and current docs still carry major future work around safe change semantics
   and durable proof.
   See
   [EVIDENCE_zero-downtime-safety-claim-witness.md](./EVIDENCE_zero-downtime-safety-claim-witness.md).
4. The old README claimed comprehensive tests, property-based proof,
   round-trip guarantees, and idempotence checks as a single public contract,
   but the repo's executable guarantees are still uneven and scattered.
   See
   [EVIDENCE_database-public-claim-guarantee-matrix.md](./EVIDENCE_database-public-claim-guarantee-matrix.md).
5. The old README presented RLS policies and the broader data-layer surface as
   if the happy path were wider and calmer than the current directive truth
   table allows.
   See
   [SOURCE_rls-and-directive-happy-path-contract.md](./SOURCE_rls-and-directive-happy-path-contract.md).
6. The old README also carried a broader public surface around playgrounds,
   hosts, packages, and future integrations. The new signposts keep the repo
   honest, but they no longer carry that whole breadth as a front-door story.
   See
   [RUNTIME_public-surface-status-matrix.md](./RUNTIME_public-surface-status-matrix.md).

## Repo Evidence

- `README.md` at commit `6672939`
- current `README.md`
- `docs/VISION.md`
- `docs/DIRECTIVES.md`
- `docs/guides/quick-start.md`
- `ROADMAP.md`
- `test/README.md`
- `test/e2e/README.md`

## Done looks like

- every major old README-to-reality gap has one repo-visible backlog note
- no future signpost refresh has to reconstruct these gaps from memory
- each gap can be resolved by one of three outcomes:
  - prove the claim and keep it public
  - narrow the claim and document the actual contract
  - retire the claim explicitly instead of letting it linger as folklore
