# Wesley Documentation

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is the calm front door for Wesley's docs.

Use it when you need to orient on the repo quickly without reverse-engineering
which signpost is supposed to answer which question.

## Signposts

| Surface                                                                     | Role                                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [README.md](../README.md)                                                   | Product-facing front door: what Wesley is, what is real today, and where to start.                    |
| [END_TO_END.md](./END_TO_END.md)                                            | Full system narrative from authored GraphQL through compiler facts, artifacts, evidence, and owners.  |
| [ENTRYPOINTS.md](./ENTRYPOINTS.md)                                          | Short answer for which Wesley to run or edit: Rust kernel, native CLI, xtask, or legacy Node tooling. |
| [LEGACY_NODE_MIGRATION.md](./LEGACY_NODE_MIGRATION.md)                      | Deletion map for the historical Node CLI, packages, generators, hosts, and evidence tooling.          |
| [WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md)                                  | Fast noun map for the Wesley base platform, modules, and project workspace.                           |
| [Wesley North Star](./NORTHSTAR.md)                                         | Domain-free doctrine for GraphQL structure, deterministic IR, and extension-owned meaning.            |
| [SDL, Shape, And Law](./SDL.md)                                             | Why GraphQL SDL is Wesley's contract substrate and where domain law interpretation belongs.           |
| [BEARING](./BEARING.md)                                                     | Current direction, what is already real in the repo, and the tensions that still matter.              |
| [Extending Wesley](./guides/extending.md)                                   | How to add Rust compiler behavior, native CLI commands, emitter projections, or external modules.     |
| [Module Authoring](./guides/module-authoring.md)                            | Current Rust-native extension boundary, descriptor fixtures, and troubleshooting.                     |
| [CLI Reference](./reference/cli.md)                                         | Current Rust-native `wesley` command reference.                                                       |
| [Project Manifest](./reference/project-manifest.md)                         | Current JSON/YAML manifest schema for schemas, rebuild selection, bundles, and target metadata.       |
| [Directive Truth Table](./reference/directives.md)                          | Current directive support levels, aliases, external families, and fixture boundaries.                 |
| [Topics](./topics/README.md)                                                | Operator and contributor task pages that bridge references, governance, and workflows.                |
| [Docs Orientation](./topics/docs-orientation.md)                            | Task page for choosing the right signpost without turning docs into a backlog mirror.                 |
| [VISION](./VISION.md)                                                       | Bounded executive synthesis grounded in repo-visible truth.                                           |
| [Design Packets](./design/README.md)                                        | Active design packets and doctrinal boundary notes.                                                   |
| [METHOD Process](./method/process.md)                                       | How cycles run, close, and reconcile in this repo.                                                    |
| [METHOD Release](./method/release.md)                                       | How releases are shaped, verified, and documented.                                                    |
| [Documentation Standard](./governance/DOCUMENTATION_STANDARD.md)            | How Wesley docs stay useful without becoming a shadow backlog.                                        |
| [Wesley Roadmap Project](https://github.com/users/flyingrobots/projects/18) | Live GitHub Project for roadmap board views.                                                          |
| [GitHub Milestones](https://github.com/flyingrobots/wesley/milestones)      | Live goalpost and release milestones.                                                                 |

## Current Center Of Gravity

Wesley's current center is the domain-free compiler boundary:

```text
GraphQL SDL -> deterministic Wesley IR -> external modules assign meaning.
```

The older Continuum-heavy packets are historical extraction context, not the
current Wesley roadmap.

The v0.0.5 clean-house packet is shipped release context:

- [Product Leftover Cleanup](./design/0012-product-leftover-cleanup/product-leftover-cleanup.md)

The completed Rust-native release floor is:

- [Rust IR Parity Sentinel](./design/0013-rust-ir-parity-sentinel/rust-ir-parity-sentinel.md)
- [Rust Native Front Door And Node Retirement](./design/0017-rust-native-front-door-and-node-retirement/rust-native-front-door-and-node-retirement.md)

The old Continuum-heavy `v0.1.0/` lane has been retired to
[graveyard/v0.1.0](./method/graveyard/v0.1.0/README.md). Treat those notes as
historical extraction context, not as active Wesley release commitments.

The active design direction is now:

- [Holmes Assurance Hexagon](./design/0018-holmes-assurance-hexagon/holmes-assurance-hexagon.md)
- [`weslaw` Semantic Law IR](./design/0019-weslaw-semantic-law-ir/weslaw-semantic-law-ir.md)

The repo already has the important generic building blocks around that
direction:

- Rust-native schema lowering, hashing, operation catalogs, and selection facts
- deterministic Rust and TypeScript projection surfaces
- generic operation artifacts whose meaning is assigned by downstream owners
- HOLMES assurance foundations over explicit evidence bundles

The former repo-local `compile-ttd`, `bundle-echo`, and Continuum witness lanes
were retired from generic Wesley during the domain-empty extraction. Recreate
those surfaces only as Continuum-owned module commands or external packages.

It also now has a more explicit METHOD closeout surface under
`docs/method/retro/`, `docs/method/graveyard/`, `docs/method/releases/`, and
`docs/releases/`.

## Start Paths

### Product Orientation

- [README.md](../README.md)
- [Topics](./topics/README.md)
- [Docs Orientation](./topics/docs-orientation.md)
- [END_TO_END.md](./END_TO_END.md)
- [ENTRYPOINTS.md](./ENTRYPOINTS.md)
- [LEGACY_NODE_MIGRATION.md](./LEGACY_NODE_MIGRATION.md)
- [WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md)
- [Wesley North Star](./NORTHSTAR.md)
- [SDL, Shape, And Law](./SDL.md)
- [CLI Reference](./reference/cli.md)
- [Project Manifest](./reference/project-manifest.md)
- [Directive Truth Table](./reference/directives.md)
- [BEARING](./BEARING.md)
- [Design Packets](./design/README.md)
- [Wesley Core Versus Toolchain](./architecture/wesley-core-vs-toolchain.md)
- [Extending Wesley](./guides/extending.md)
- [Module Authoring](./guides/module-authoring.md)
- [Module Contract](./design/wesley-module-contract.md)

### Historical Continuum Extraction Context

- [BEARING](./BEARING.md)
- [Retired Wesley Role In Continuum](./architecture/continuum-wesley-role.md)
- [Retired Continuum Minimum Shared Contract Surface](./architecture/continuum-minimum-shared-contract-surface.md)
- [Continuum Contract Compiler](./design/0003-continuum-contract-compiler/continuum-contract-compiler.md)
- [0003 Retro](./method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md)

### Workflow Orientation

- [METHOD Process](./method/process.md)
- [METHOD Guide](./method/guide.md)
- [Documentation Standard](./governance/DOCUMENTATION_STANDARD.md)
- [Topics](./topics/README.md)
- [Wesley Roadmap Project](https://github.com/users/flyingrobots/projects/18)
- [GitHub Milestones](https://github.com/flyingrobots/wesley/milestones)
- [Legacy Backlog Signpost](./method/backlog/README.md) (historical only)
- [Retro Packets](./method/retro/README.md)
- [METHOD Release](./method/release.md)

## Stable Reference Surfaces

- [Invariants](./invariants/README.md)
- [Legends](./method/legends/README.md)
- [CLI Reference](./reference/cli.md)
- [Project Manifest](./reference/project-manifest.md)
- [Directive Truth Table](./reference/directives.md)

## Current Honesty Rules

- The root `README.md` is intentionally product-facing, not the full METHOD
  doctrine front door.
- Active execution lives in GitHub Issues, Milestones, Projects, and labels.
  `docs/BEARING.md` is a direction surface, not a progress tracker.
- If docs contradict runtime behavior, the docs must change.
- Retros and witnesses are the closeout surface; chat and PR commentary are
  not enough on their own.
- Do not add repo-local backlog cards, live progress bars, slice ledgers, or
  release-gate checklists. File and triage GitHub Issues instead.
