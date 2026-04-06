# VISION
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is a bounded executive synthesis grounded in repo-visible sources.

## Identity

Wesley is a schema-first, local-first compiler repo for trustworthy change and
shared contracts.

It is not just one thing:

- one real surface compiles GraphQL SDL into PostgreSQL-facing artifacts,
  migration plans, tests, and evidence
- another real surface compiles shared GraphQL schemas into TTD manifests,
  Echo bundle artifacts, and a local Continuum witness

Across both surfaces, the governing claim is the same: authored schema is the
source of truth, derived artifacts are not peer authorities, and judgment
should stay honest about the strength of its evidence.

## What Is Already Real

- The database-change lane remains real through `generate`, `plan`,
  `rehearse`, `blade`, certification, and HOLMES-family evidence work.
- The Continuum lane is now real enough to inspect through `compile-ttd`,
  `bundle-echo`, and `witness-continuum`.
- The current minimum shared Continuum surface is explicitly named as
  `schemas/ttd-protocol.graphql` plus `schemas/echo-core-types.graphql`.
- Wesley's Continuum role is explicitly bounded to contract compilation,
  publication boundaries, conformance, and judgment rather than runtime,
  storage, debugger, or substrate-fact ownership.
- The repo now uses METHOD as its visible workflow surface: backlog, design,
  retro, graveyard, and release files are first-class repo truth.

## Product Direction

The strategy of record still lives in [ROADMAP.md](../ROADMAP.md), especially
the V2 fixed contracts around runtime truth, evidence truth, and the long move
toward one durable run model.

The current center of gravity in the repo, however, is narrower:

- make Wesley's Continuum role honest
- freeze one boring shared contract family
- prove one compile path and one witness lane
- keep neighboring repo boundaries explicit

That makes the current hill less about broad platform claims and more about one
small, inspectable contract-compiler proving move.

## Intended Public Product Shape

The older public README over-claimed some of these ideas as if they were
already fully true. The direction itself still stands.

Wesley is still trying to earn this broader public shape:

- a release-grade, evidence-backed database lane that can honestly be described
  as production-ready and battle-tested
- one boring public operator story:
  `generate -> plan -> rehearse -> certify -> deploy`
- a broad, explicit zero-downtime and safe-change envelope with clearly named
  limits
- one public proof matrix that bundles comprehensive tests,
  property-oriented checks, round-trip guarantees, and idempotence claims
- a broad, calm RLS and data-layer happy path with one canonical schema story
- a coherent public product surface across playgrounds, packages, hosts, and
  integrations

Those are goals, not present-tense guarantees. The repo should keep them
visible without smuggling them back into current-state claims.

## Repo Working Model

Wesley now uses a METHOD-shaped repo surface:

- [README.md](../README.md) is the product-facing front door
- [docs/BEARING.md](./BEARING.md) carries current direction and tensions
- [docs/VISION.md](./VISION.md) carries bounded synthesis
- [docs/method/backlog/](./method/backlog/README.md) is the queue
- [docs/design/](./design/README.md) carries active committed work
- [docs/method/retro/](./method/retro/README.md) carries closed-cycle packets
- [docs/method/releases/](./method/releases/README.md) and
  [docs/releases/](./releases/README.md) carry release surfaces

The filesystem is the queue and the primary repo-visible coordination surface.
Chat, trackers, and PR discussion can help, but they do not outrank the files.

## Current Tensions

- Wesley's older public story is still heavily PostgreSQL-first, while the
  most recent cycle packet centered on Continuum contract compilation and
  closed as `partial`.
- The repo now has a real minimum-surface witness, but not yet the frozen
  receipt-family proof lane it wants to be judged on.
- Ownership boundaries are much clearer in doctrine than they are in enforced
  runtime or CI policy.
- The METHOD closeout surface is now explicit, but Wesley still needs more real
  retro packets and witness directories before that shape feels fully lived-in.
- The repo now has a cleaner, more honest front door, but it still has to earn
  several older north-star promises rather than quietly forgetting them.

## Limits

This document is a bounded synthesis over repo-visible artifacts. It does not
claim:

- that the full Continuum contract surface is already frozen
- that Wesley owns runtime, storage, debugger, or substrate semantics
- that every older product-facing doc claim has already been retired or
  rewritten
- more semantic provenance than the files and commands in the repo can support
