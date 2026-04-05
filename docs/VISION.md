# VISION
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is a bounded executive synthesis grounded in repo-visible sources.

## Identity

Wesley is a schema-first, local-first system for trustworthy database change.
GraphQL is the source of truth. Wesley turns that into PostgreSQL DDL, phased
migrations, TypeScript types, Zod schemas, RLS policies, tests, evidence
bundles, and deployment judgments.

The product is trying to make database change boring without making the
underlying truth invisible.

## Core Pillars

Wesley's current product pillars are:

- **Source authority**: GraphQL SDL plus explicit Wesley inputs define intended
  behavior. Generated artifacts are derived. This is the authority claim behind
  [schema-source-of-truth](./invariants/schema-source-of-truth.md).
- **Transmutation breadth**: Wesley should be able to compile GraphQL into many
  executable artifact domains, not just one backend path. The repo's formal
  name for this is **transmutations**, not "GraphQL to Anything."
- **Runtime truth**: when Wesley has a run model, the ledger outranks snapshots
  and materialized outputs.
- **Evidence truth**: scores, gates, and certs must reflect the actual strength
  of supporting evidence.
- **Local-first operation**: core workflows should remain operable from a local
  checkout and local runtime state.
- **Governed judgment**: Wesley owns the meaning of readiness, risk, and
  certification even when substrate tools provide the underlying facts.

These are not all the same kind of claim. Some are invariants that must remain
true. Some are product theses that describe the breadth Wesley is trying to
reach. The distinction matters:

- `schema-source-of-truth` is an invariant about authority.
- `transmutation breadth` is a product pillar about output scope.

## Product Direction

The canonical product strategy still lives in [ROADMAP.md](../ROADMAP.md).
Today, the center of gravity is:

- late Phase 2 durability: one run model, honest replay/resume, bounded
  materialization, and local inspection
- active Phase 3 truthfulness: exact evidence spans, fewer provisional paths,
  and tools that do not pretend weak evidence is strong

HOLMES, WATSON, MORIARTY, and certification work matter here because they are
where Wesley's evidence claims become operator-visible judgment.

## Repo Working Model

This repo now uses METHOD for coordination:

- signposts tell you where the repo is pointed
- backlog lanes tell you what is queued
- design packets tell you what is actively committed
- retros and witnesses tell you what was actually proved

The filesystem is the queue and the primary repo-visible history surface.
Retros, witnesses, and updated signposts carry what was actually proved. The
Chronicle files are archive only.

The current application legends are:

- `SOURCE`
- `TRANSMUTE`
- `RUNTIME`
- `EVIDENCE`

## Current Tensions

- Wesley's product doctrine already values runtime truth and boring operator
  flows, but the previous workflow surface hid active work behind external
  trackers and sprawling prose.
- Product strategy and repo workflow were coupled too loosely: the strategy was
  visible, but the active queue was not.
- Evidence work is improving, especially around Holmes/Moriarty
  counterfactuals, but the repo still needs a calmer, more inspectable way to
  carry that work from idea to proof.

## Limits

This document is a bounded synthesis over repo-visible artifacts. It does not
claim more provenance than the files it names and the branch state that carries
them.
