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
| [roadmap.md](./roadmap.md) | Archived strategic note: harvested V2 phase plan and remaining long-range context. |
| [METHOD Process](./method/process.md) | How cycles run, close, and reconcile in this repo. |
| [METHOD Release](./method/release.md) | How releases are shaped, verified, and documented. |

## Current Center Of Gravity

The most recent Continuum cycle packet is
[Continuum Contract Compiler](./design/0003-continuum-contract-compiler/continuum-contract-compiler.md).
It closed as a `partial` landing in
[its retro packet](./method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md).

The active carry-over for the first release now lives in the Continuum
`v0.1.0/` lane:

- [SOURCE_continuum-ownership-map-for-shared-nouns](./method/backlog/v0.1.0/SOURCE_continuum-ownership-map-for-shared-nouns.md)
- [RUNTIME_continuum-local-compile-and-inspect-surface](./method/backlog/v0.1.0/RUNTIME_continuum-local-compile-and-inspect-surface.md)
- [EVIDENCE_continuum-conformance-and-roundtrip-witness](./method/backlog/v0.1.0/EVIDENCE_continuum-conformance-and-roundtrip-witness.md)

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
- [roadmap.md](./roadmap.md)
- [Architecture Overview](./architecture/overview.md)

### Continuum Orientation

- [BEARING](./BEARING.md)
- [Wesley Role In Continuum](./architecture/continuum-wesley-role.md)
- [Continuum Minimum Shared Contract Surface](./architecture/continuum-minimum-shared-contract-surface.md)
- [Continuum Contract Compiler](./design/0003-continuum-contract-compiler/continuum-contract-compiler.md)
- [0003 Retro](./method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md)

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
- `docs/roadmap.md` is legacy strategic context; active execution lives in the
  filesystem queue, with `docs/BEARING.md` as the current direction surface.
- If docs contradict runtime behavior, the docs must change.
- Retros and witnesses are the closeout surface; chat and PR commentary are
  not enough on their own.
