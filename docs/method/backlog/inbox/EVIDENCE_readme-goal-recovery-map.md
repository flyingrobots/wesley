# README Goal Recovery Map

- Lane: `inbox`
- Legend: `EVIDENCE`

## Why now

The previous root `README.md` carried a much larger public product story than
the repo could prove cleanly today. The signpost refresh made the front door
more honest, but that honesty creates a second risk: the older north-star shape
could disappear entirely instead of surviving as explicit goals.

This note preserves those goals explicitly and links each one to a backlog item
so the repo can earn the claim, narrow it honestly, or retire it on purpose.

## Goals To Recover

1. Wesley should eventually earn a release-grade, evidence-backed
   `production-ready` / `battle-tested` database lane.
   See
   [EVIDENCE_release-grade-database-lane.md](./EVIDENCE_release-grade-database-lane.md).
2. Wesley should expose one boring public operator story:
   `generate -> plan -> rehearse -> certify -> deploy`.
   See
   [RUNTIME_boring-database-operator-surface.md](./RUNTIME_boring-database-operator-surface.md).
3. Wesley should earn a broad, explicit zero-downtime and safe-change
   envelope.
   See
   [EVIDENCE_broad-zero-downtime-safety-envelope.md](./EVIDENCE_broad-zero-downtime-safety-envelope.md).
4. Wesley should publish one public proof matrix for comprehensive tests,
   property-oriented checks, round-trip guarantees, and idempotence claims.
   See
   [EVIDENCE_database-guarantee-proof-matrix.md](./EVIDENCE_database-guarantee-proof-matrix.md).
5. Wesley should have a broad, calm RLS and data-layer happy path with one
   canonical schema story.
   See
   [SOURCE_broad-rls-and-data-layer-happy-path.md](./SOURCE_broad-rls-and-data-layer-happy-path.md).
6. Wesley should present one coherent public surface across playgrounds,
   packages, hosts, and integrations.
   See
   [RUNTIME_coherent-public-surface-matrix.md](./RUNTIME_coherent-public-surface-matrix.md).

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

- every major old README-to-reality goal has one repo-visible backlog note
- no future signpost refresh has to reconstruct these goals from memory
- each goal can be resolved by one of three outcomes:
  - prove the claim and keep it public
  - narrow the claim and document the actual contract
  - retire the claim explicitly instead of letting it linger as folklore
