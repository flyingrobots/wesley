# Wesley Documentation
<!-- docs-truth: status=experimental owner=@flyingrobots -->

## Start Here

- [README.md](../README.md) — Product-facing front door and repo shape
- [BEARING](./BEARING.md) — Current direction and tensions
- [VISION](./VISION.md) — Bounded executive synthesis
- [ROADMAP.md](../ROADMAP.md) — Canonical V2 strategy and fixed contracts
- [METHOD Process](./method/process.md) — Repo workflow and cycle loop
- [METHOD Release](./method/release.md) — Release doctrine and versioned release surfaces
- [Contributing](../CONTRIBUTING.md) — Wesley-specific contributor guide
- [Agent Guide](../AGENTS.md) — Repo instructions for autonomous contributors

## Product and Architecture

- [The Paradigm Shift](./architecture/paradigm-shift.md) — Why GraphQL should be your source of truth
- [Architecture Overview](./architecture/overview.md) — Hexagonal, event-driven, command pattern design
- [Wesley Role In Continuum](./architecture/continuum-wesley-role.md) — Wesley's contract, publication-boundary, conformance, and judgment role in the Continuum stack
- [Continuum Minimum Shared Contract Surface](./architecture/continuum-minimum-shared-contract-surface.md) — The current finite shared noun families Wesley carries locally
- [The Algorithm](./architecture/algorithm.md) — How GraphQL becomes SQL, TypeScript, Zod, and more
- [Directive Truth Table](./DIRECTIVES.md) — What the shipped parser/compiler path actually supports today
- [Test Generation](./architecture/test-generation.md) — Automatic pgTAP tests from migrations
- [IR Family Overview](./spec/ir-family.md) — Concise reference of Wesley's IR family
- [IR Family Specification](./spec/ir-family-spec.md) — Full prose specification and design
- [QIR Specification](./spec/qir.md) — Query Intermediate Representation spec
- [Internals Deep Dive](./internals/deep-dive.md) — How Wesley works under the hood
- [Event Flow](./internals/event-flow.md) — Tracing events through the system
- [Parser Design](./internals/parser.md) — GraphQL SDL to domain model transformation
- [SHA-lock HOLMES Integration](./architecture/holmes-integration.md) — Evidence bundles, investigations, and CI reports

## Guides

- [Quick Start](./guides/quick-start.md) — Get running in 60 seconds
- [Ops (Query Operations)](./guides/qir-ops.md) — Author ops plans, manifest, discovery, validation, and SQL emission
- [Extending Wesley](./guides/extending.md) — Add new generators and adapters
- [Migration Strategies](./guides/migrations.md) — Managing schema evolution
- [Browser Playground](./guides/browser-playground.md) — Explore Wesley locally in the browser

## Workflow Surface

- [BEARING](./BEARING.md) — Direction and tensions at cycle boundaries
- [VISION](./VISION.md) — Bounded executive synthesis of repo-visible truth
- [METHOD Process](./method/process.md) — Pull, design, test, playback, close
- [METHOD Guide](./method/guide.md) — Practical repo guidance
- [METHOD Release](./method/release.md) — Release doctrine and scope rules
- [Retro Packets](./method/retro/README.md) — Cycle closeout packet layout
- [Internal Releases](./method/releases/README.md) — Versioned internal release packets
- [Release Notes](./releases/README.md) — User-facing release documentation
- [Graveyard](./method/graveyard/README.md) — Rejected or retired work with context
- [Backlog](./method/backlog/README.md) — Filesystem queue and lane semantics
- [Legends](./method/legends/README.md) — Named domains that guard invariants
- [Invariants](./invariants/README.md) — Properties that must remain true
