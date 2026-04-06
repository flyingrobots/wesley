# Wesley Documentation
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is the calm front door for Wesley's docs.

Use it when you need to orient on the repo quickly without reverse-engineering
which signpost is supposed to answer which question.

## Signposts

| Surface | Role |
| --- | --- |
| [README.md](../README.md) | Product-facing front door: what Wesley is, what is real today, and where to start. |
| [BEARING](./BEARING.md) | Current direction, what is already real in the repo, and the tensions that still matter. |
| [VISION](./VISION.md) | Bounded executive synthesis grounded in repo-visible truth. |
| [ROADMAP.md](../ROADMAP.md) | Strategy of record: fixed contracts, phase order, and release gates. |
| [METHOD Process](./method/process.md) | How cycles run, close, and reconcile in this repo. |
| [METHOD Release](./method/release.md) | How releases are shaped, verified, and documented. |

## Current Center Of Gravity

The current active packet is
[Continuum Contract Compiler](./design/0003-continuum-contract-compiler/continuum-contract-compiler.md).
That packet is trying to prove one boring Continuum contract family from schema
to generated artifacts to conformance witness without letting Wesley absorb
runtime, storage, or debugger policy.

The repo already has three important building blocks around that hill:

- a real TTD compile path via
  [compile-ttd](../packages/wesley-cli/src/commands/compile-ttd.mjs)
- a real Echo bundle wrapper via
  [bundle-echo](../packages/wesley-cli/src/commands/bundle-echo.mjs)
- a real current-state witness path via
  [witness-continuum](../packages/wesley-cli/src/commands/witness-continuum.mjs)

It also now has a more explicit METHOD closeout surface under
`docs/method/retro/`, `docs/method/graveyard/`, `docs/method/releases/`, and
`docs/releases/`.

## Start Paths

### Product Orientation

- [README.md](../README.md)
- [ROADMAP.md](../ROADMAP.md)
- [Architecture Overview](./architecture/overview.md)

### Continuum Orientation

- [BEARING](./BEARING.md)
- [Wesley Role In Continuum](./architecture/continuum-wesley-role.md)
- [Continuum Minimum Shared Contract Surface](./architecture/continuum-minimum-shared-contract-surface.md)
- [Continuum Contract Compiler](./design/0003-continuum-contract-compiler/continuum-contract-compiler.md)

### Workflow Orientation

- [METHOD Process](./method/process.md)
- [METHOD Guide](./method/guide.md)
- [Backlog](./method/backlog/README.md)
- [Retro Packets](./method/retro/README.md)
- [METHOD Release](./method/release.md)

## Stable Reference Surfaces

- [Invariants](./invariants/README.md)
- [Legends](./method/legends/README.md)
- [Directive Truth Table](./DIRECTIVES.md)
- [QIR Specification](./spec/qir.md)
- [IR Family Specification](./spec/ir-family-spec.md)

## Current Honesty Rules

- The root `README.md` is intentionally product-facing, not the full METHOD
  doctrine front door.
- `ROADMAP.md` is the strategy of record; active execution lives in the
  filesystem queue.
- If docs contradict runtime behavior, the docs must change.
- Retros and witnesses are the closeout surface; chat and PR commentary are
  not enough on their own.
