# Weslaw

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when working with `weslaw/v1` authoring files or law-derived
compiler evidence.

`weslaw` lets authors attach structured law metadata to GraphQL structure.
Wesley validates and reports that structure; downstream owners decide how those
laws are used in a domain.

## Common Tasks

Scaffold law from known SDL directives:

```bash
cargo run --bin wesley -- init-law \
  --schema schema.graphql \
  --family example.family \
  --out example.weslaw.yaml
```

Lint law shape without binding it to a schema:

```bash
cargo run --bin wesley -- law lint --law example.weslaw.yaml --json
```

Validate law against active SDL:

```bash
cargo run --bin wesley -- law validate \
  --schema schema.graphql \
  --law example.weslaw.yaml \
  --json
```

Compare law states:

```bash
cargo run --bin wesley -- law diff \
  --old old.weslaw.yaml \
  --new new.weslaw.yaml \
  --schema schema.graphql \
  --format summary
```

Report release coverage:

```bash
cargo run --bin wesley -- law coverage \
  --schema schema.graphql \
  --law example.weslaw.yaml \
  --profile release \
  --json
```

## Rules Of Thumb

- Draft suggestions are not active law.
- Binding law to SDL must use current schema hashes and resolvable subjects.
- Coverage profiles are evidence and release inputs, not product policy.
- Domain-specific enforcement belongs outside Wesley core.

## Related Authority

- [CLI Reference](../reference/cli.md#law)
- [Weslaw Semantic Law IR](../design/0019-weslaw-semantic-law-ir/weslaw-semantic-law-ir.md)
- [HOLMES CI](./holmes-ci.md)
- [Compiler Boundary](./compiler-boundary.md)
