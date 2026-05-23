# Wesley Documentation

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is the calm front door for Wesley's docs.

Use it when you need to orient on the repo quickly without reverse-engineering
which signpost is supposed to answer which question.

## Signposts

| Surface                                                | Role                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [README.md](../README.md)                              | Product-facing front door: what Wesley is, what is real today, and where to start.                    |
| [ENTRYPOINTS.md](./ENTRYPOINTS.md)                     | Short answer for which Wesley to run or edit: Rust kernel, native CLI, xtask, or legacy Node tooling. |
| [LEGACY_NODE_MIGRATION.md](./LEGACY_NODE_MIGRATION.md) | Deletion map for the historical Node CLI, packages, generators, hosts, and evidence tooling.          |
| [WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md)             | Fast noun map for the Wesley base platform, modules, and project workspace.                           |
| [Wesley North Star](./NORTHSTAR.md)                    | Ultimate doctrine for bounded, lawful autonomy through GraphQL-declared runtime optics.               |
| [SDL, Shape, And Law](./SDL.md)                        | Why GraphQL SDL is Wesley's contract substrate and where domain law interpretation belongs.           |
| [BEARING](./BEARING.md)                                | Current direction, what is already real in the repo, and the tensions that still matter.              |
| [Extending Wesley](./guides/extending.md)              | How to add Rust compiler behavior, native CLI commands, emitter projections, or external modules.     |
| [VISION](./VISION.md)                                  | Bounded executive synthesis grounded in repo-visible truth.                                           |
| [Design Packets](./design/README.md)                   | Active design packets and doctrinal boundary notes.                                                   |
| [METHOD Process](./method/process.md)                  | How cycles run, close, and reconcile in this repo.                                                    |
| [METHOD Release](./method/release.md)                  | How releases are shaped, verified, and documented.                                                    |

## Current Center Of Gravity

The most recent Continuum cycle packet is
[Continuum Contract Compiler](./design/0003-continuum-contract-compiler/continuum-contract-compiler.md).
It closed as a `partial` landing in
[its retro packet](./method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md).

The v0.0.5 clean-house packet is shipped release context:

- [Product Leftover Cleanup](./design/0012-product-leftover-cleanup/product-leftover-cleanup.md)

The active release center is now v0.0.6 Rust IR parity:

- [Rust IR Parity Sentinel](./design/0013-rust-ir-parity-sentinel/rust-ir-parity-sentinel.md)

The old Continuum-heavy `v0.1.0/` lane has been retired to
[graveyard/v0.1.0](./method/graveyard/v0.1.0/README.md). Treat those notes as
historical extraction context, not as active Wesley release commitments.

The repo already has the important generic building blocks around that
direction:

- a module-driven `wesley compile` surface where targets come from loaded
  external modules
- a real current-state witness path via
  the Continuum-owned Wesley module that lives outside this repository

The former repo-local `compile-ttd` and `bundle-echo` commands were retired
from generic Wesley during the domain-empty extraction. Recreate those surfaces
only as Continuum-owned module commands or external packages.

It also now has a more explicit METHOD closeout surface under
`docs/method/retro/`, `docs/method/graveyard/`, `docs/method/releases/`, and
`docs/releases/`.

## Start Paths

### Product Orientation

- [README.md](../README.md)
- [ENTRYPOINTS.md](./ENTRYPOINTS.md)
- [LEGACY_NODE_MIGRATION.md](./LEGACY_NODE_MIGRATION.md)
- [WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md)
- [Wesley North Star](./NORTHSTAR.md)
- [SDL, Shape, And Law](./SDL.md)
- [BEARING](./BEARING.md)
- [Design Packets](./design/README.md)
- [Wesley Core Versus Toolchain](./architecture/wesley-core-vs-toolchain.md)
- [Extending Wesley](./guides/extending.md)
- [Module Contract](./design/wesley-module-contract.md)

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

## Current Honesty Rules

- The root `README.md` is intentionally product-facing, not the full METHOD
  doctrine front door.
- Active execution lives in the filesystem queue, with `docs/BEARING.md` as
  the current direction surface and `docs/design/README.md` as the design
  packet index.
- If docs contradict runtime behavior, the docs must change.
- Retros and witnesses are the closeout surface; chat and PR commentary are
  not enough on their own.
