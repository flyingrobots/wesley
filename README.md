# Wesley
<!-- docs-truth: status=experimental owner=@flyingrobots -->

[![Overall](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/flyingrobots/wesley/main/meta/badges/overall.json)](README.md)
[![Browser Smoke](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml/badge.svg?branch=main)](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml)
[![Runtime Smokes](https://github.com/flyingrobots/wesley/actions/workflows/runtime-smokes.yml/badge.svg?branch=main)](https://github.com/flyingrobots/wesley/actions/workflows/runtime-smokes.yml)

> [!note]
> Wesley is experimental. The repo carries real compiler and evidence paths, but
> not every old doc claim or future platform idea is already shipped behavior.

Wesley is a schema-first compiler repo for trustworthy change and shared
contracts.

Today it has two honest working surfaces:

- a database-change surface that turns GraphQL SDL into PostgreSQL-facing
  artifacts, plans, tests, and evidence
- a Continuum contract surface that compiles shared GraphQL schemas into TTD
  manifests, Echo bundle artifacts, and a local conformance witness

GraphQL SDL remains the authored source. Generated artifacts, manifests,
codecs, tests, and operator-facing judgments are derived surfaces.

Unlike a pure METHOD repo, this root `README.md` stays product-facing. Repo
workflow doctrine lives in [docs/README.md](docs/README.md),
[docs/method/process.md](docs/method/process.md), and
[docs/method/release.md](docs/method/release.md).

## What Is Real Today

### Database-Change Lane

Wesley already ships a real GraphQL-to-PostgreSQL path around:

- `wesley generate`
- `wesley plan`
- `wesley rehearse`
- `wesley blade`
- HOLMES, certification, and run inspection surfaces

That lane is still the most mature production-shaped surface in the repo.

### Continuum Contract Lane

Wesley also now ships a real first Continuum-shaped contract lane:

- `wesley compile` treats contract compilation like a compiler surface:
  schema in, consumer targets out, one output root
- `wesley compile` now also emits a lightweight realization manifest under the
  output root so generated legs carry build traceability without claiming
  conformance proof
- `wesley compile-ttd` compiles `schemas/ttd-protocol.graphql` into manifest
  and TypeScript outputs
- `wesley bundle-echo` compiles `schemas/echo-core-types.graphql` into Echo
  bundle artifacts plus a mocked `warp-ttd` deliveries surface
- the first shared proving family is now authored in Continuum under
  `<continuum-root>/schemas/continuum-receipt-family.graphql`
- Wesley still carries a repo-local compatibility copy of that family under
  `schemas/continuum-receipt-family.graphql` while tests and witnesses are
  being cut over
- `wesley witness-continuum` verifies the current minimum TTD-plus-Echo surface
  and writes a local conformance report

This is not yet the full frozen receipt-family proving lane. The current
witness-backed minimum subset is still the bounded TTD-plus-Echo pair
described in
[Continuum Minimum Shared Contract Surface](docs/architecture/continuum-minimum-shared-contract-surface.md).

## Current Limits

- Wesley is not yet one finished Continuum contract platform.
- The first boring receipt-family proof lane is now Continuum-authored, but
  the full artifact, fixture, and witness path is still not shipped fact.
- Runtime, storage, debugger, and substrate-fact ownership stay outside
  Wesley's claimed authority unless a packet names otherwise explicitly.
- Directive support is broader in the registry than on the current happy path;
  use [docs/DIRECTIVES.md](docs/DIRECTIVES.md) before relying on non-core
  directives.

## Quick Start

### Repo Setup

```bash
git clone https://github.com/flyingrobots/wesley.git
cd wesley
pnpm install
pnpm run preflight
pnpm wesley --help
```

### Try The Database-Change Surface

```bash
pnpm wesley generate \
  --schema test/fixtures/examples/ecommerce.graphql \
  --ops test/fixtures/examples/ops \
  --emit-bundle \
  --out-dir out/examples

pnpm wesley plan \
  --schema test/fixtures/examples/schema.graphql \
  --explain

pnpm wesley rehearse \
  --schema test/fixtures/examples/schema.graphql \
  --dry-run \
  --json
```

### Try The Continuum Surface

```bash
pnpm wesley compile \
  --schema <continuum-root>/schemas/continuum-receipt-family.graphql \
  --target warp-ttd,echo \
  --out-dir .wesley-cache/continuum/local-inspect

# realization manifest:
# .wesley-cache/continuum/local-inspect/realization/manifest.json

pnpm wesley witness-continuum \
  --ttd-dir .wesley-cache/continuum/local-inspect/warp-ttd \
  --echo-dir .wesley-cache/continuum/local-inspect/echo \
  --json
```

## Start Here

| Surface | Why it matters |
| --- | --- |
| [docs/README.md](docs/README.md) | The docs front door and signpost index. |
| [docs/BEARING.md](docs/BEARING.md) | Current direction, active tensions, and what is already real. |
| [docs/VISION.md](docs/VISION.md) | Bounded executive synthesis grounded in repo-visible truth. |
| [ROADMAP.md](ROADMAP.md) | Fixed contracts, phase order, and longer-range strategy. |
| [docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md](docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md) | The most recent Continuum proving packet. |
| [docs/method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md](docs/method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md) | The partial closeout for that cycle and its carry-over context. |
| [docs/method/process.md](docs/method/process.md) | METHOD workflow and cycle closeout rules. |

## Repo Shape

The repo-visible workflow surface is:

- `docs/method/backlog/` for queued work
- `docs/design/` for active cycle packets
- `docs/method/retro/` for closed cycle packets
- `docs/method/releases/` for internal release packets
- `docs/releases/` for user-facing release notes

The filesystem is the queue. Signposts summarize the repo state; they do not
replace backlog items, design packets, retros, or witnesses.

## Product Pillars

Wesley's current product pillars are:

- source authority
- transmutation breadth
- runtime truth
- evidence truth
- local-first operation
- governed judgment

The exact invariants behind those claims live in
[docs/invariants/README.md](docs/invariants/README.md).

## Contributing

If you are contributing to the repo rather than evaluating the product:

1. Read [docs/README.md](docs/README.md),
   [docs/method/process.md](docs/method/process.md), and
   [AGENTS.md](AGENTS.md).
2. Use the filesystem queue under [docs/method/backlog/](docs/method/backlog/).
3. Prove claims with tests and rerunnable witnesses.
4. Close the loop in repo files instead of leaving status only in chat or PR
   commentary.

## Links

- [Architecture Docs](docs/architecture/overview.md)
- [Directive Truth Table](docs/DIRECTIVES.md)
- [Continuum Minimum Shared Contract Surface](docs/architecture/continuum-minimum-shared-contract-surface.md)
- [Wesley Role In Continuum](docs/architecture/continuum-wesley-role.md)
- [METHOD Process](docs/method/process.md)
- [Website](https://flyingrobots.github.io/wesley/)
