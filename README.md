<!-- docs-truth: status=experimental owner=@flyingrobots -->

# Wesley

> "Things are only impossible until they're not."
> -- Jean-Luc Picard

<div align="center">
<img src="https://github.com/user-attachments/assets/0c03a527-dc36-466f-a212-a3a24731acf8" alt="Wesley" />
</div>

**Wesley is a domain-free GraphQL-to-IR transformation toolchain.**

Wesley extracts the structure described by GraphQL SDL, lowers that structure
into deterministic JSON IR, and provides hooks for you to give it semantics in
your own extensions.

> _There is no graph. Only structure and what you make of it._

```text
GraphQL SDL -> deterministic Wesley IR -> your domain via extensions
```

Wesley is deliberately domain-empty. It claims no ownership over runtime law,
scheduler semantics, persistence models, replication behavior, storage engines,
transport protocols, or substrate truth. Those concerns belong to extension
modules, sibling repos, or consuming applications.

**Wesley owns the GraphQL-to-IR transformation. Extensions own meaning.**

## Stability

Wesley is pre-1.0 software. APIs, CLI commands, generated artifacts, metadata
schemas, and extension boundaries can still change between `0.x` releases.

Use Wesley when you want deterministic build-time structure extraction and are
comfortable pinning versions. Treat generated artifacts and extension contracts
as release-scoped until the project declares a stable `1.0` surface.

## Quick Start

Install the published native CLI:

```bash
cargo install wesley-cli --version 0.1.0
wesley --help
```

From a source checkout:

```bash
cargo install --locked --path crates/wesley-cli
cargo wesley --help
cargo xtask preflight
```

Lower GraphQL SDL into Wesley L1 IR:

```bash
cargo wesley schema lower \
  --schema test/fixtures/ir-parity/small-schema.graphql \
  --json
```

Generate target-neutral Rust or TypeScript projections:

```bash
cargo wesley emit rust \
  --schema test/fixtures/weslaw/contract-bundle-shape.graphql \
  --out generated/model.rs \
  --metadata-out generated/model.metadata.json

cargo wesley emit typescript \
  --schema test/fixtures/weslaw/contract-bundle-shape.graphql \
  --out generated/types.ts \
  --metadata-out generated/types.metadata.json
```

Run the local release-quality gate before opening a PR:

```bash
cargo xtask preflight
```

The retained pnpm workspace supports docs, Holmes assurance tooling, and
workspace checks. Use Node `>=22.12.0` with pnpm `9.15.9` when working from
this checkout.

## What Wesley Owns

Wesley owns domain-free compiler facts:

- GraphQL SDL parsing and normalization
- deterministic L1 IR and schema hashes
- schema diffs and root operation catalogs
- operation selection and directive-argument extraction
- Rust and TypeScript model and operation bindings
- TypeScript and Rust LE-binary codec projections
- `weslaw/v1` authoring, hashing, diffing, rebinding, and coverage metadata
- release and assurance checks around those generic compiler contracts

Wesley preserves directives as inspectable structure. It does not decide what
those directives mean for a database, runtime, product, graph rewrite system,
transport, scheduler, or application. Extension owners do that work.

The detailed ownership rule lives in
[Domain-Empty Core Boundary](./docs/design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md).

## External Module Examples

A single schema can be compiled by many extensions simultaneously. Each
extension consumes Wesley IR independently and emits its own artifacts.

| Module family | External owner                    | Responsibility                                        |
| :------------ | :-------------------------------- | :---------------------------------------------------- |
| Postgres      | `wesley-postgres`                 | SQL schemas, migrations, indexes, pgTAP, CRUD helpers |
| Validation    | external target/module            | Runtime and static validation rules                   |
| TypeScript    | Wesley emitter or external target | Type contracts and client bindings                    |
| Codec         | Wesley emitter or external target | Binary and runtime codecs                             |
| Echo          | Echo-owned integration            | Runtime law, footprints, observation semantics        |
| Continuum     | Continuum-owned module/repo       | Deferred protocol generation                          |

## Current Release

Wesley `0.1.0` is the LE-binary codec-plan release. It ships the shared codec
plan, TypeScript decode result cleanup, trailing-byte rejection, runtime port
contracts, and the Rust-native compiler hardening staged before the release
packet was finalized.

For complete history, read [CHANGELOG.md](./CHANGELOG.md).

## Reference Map

- [Docs entrance](./docs/README.md)
- [Guide](./docs/GUIDE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Wesley North Star](./docs/NORTHSTAR.md)
- [SDL, Shape, And Law](./docs/SDL.md)
- [End To End](./docs/END_TO_END.md)
- [Entrypoints](./docs/ENTRYPOINTS.md)
- [CLI reference](./docs/reference/cli.md)
- [Directive truth table](./docs/reference/directives.md)
- [Technical teardown](./docs/TECHNICAL_TEARDOWN.md)
- [Release policy](./docs/governance/RELEASE_POLICY.md)
- [Contributing](./CONTRIBUTING.md)
- [Support](./SUPPORT.md)
- [Security](./SECURITY.md)

## Anti-Goals

Wesley is not:

- a runtime
- a scheduler
- a database
- a replication engine
- a GraphQL server replacement
- a universal protocol
- a transport framework
- a venue for domain-specific product semantics

Keeping Wesley narrow is what lets extensions own rich semantics without
turning the compiler into hidden platform ideology.

## Support

Use [SUPPORT.md](./SUPPORT.md) for questions, issue routing, security reporting,
and release-support expectations.
