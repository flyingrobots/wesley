# Plain Wesley

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this page for the first hour with Wesley. It avoids internal assurance
vocabulary and stays on the shipped compiler surface:

```text
GraphQL SDL -> deterministic Wesley L1 IR JSON -> optional generic emitters
```

External targets decide what the schema means at runtime. Wesley records
structure, hashes, operations, directives, and generated generic artifacts. It
does not decide database, routing, renderer, product, or execution semantics.

## Core Model

| Familiar Term        | Wesley Term       | Plain Meaning                                                                |
| -------------------- | ----------------- | ---------------------------------------------------------------------------- |
| GraphQL SDL          | source schema     | The `.graphql` file Wesley parses.                                           |
| GraphQL type         | L1 type           | A type record in deterministic IR.                                           |
| GraphQL field        | L1 field          | A field record with a name, type reference, arguments, and directives.       |
| GraphQL directive    | directive payload | Structured data copied into IR without Wesley executing its meaning.         |
| Query/Mutation field | operation         | A root operation fact Wesley can list and use for bindings.                  |
| Schema hash          | evidence hash     | A stable digest for the normalized compiler view of a schema.                |
| L1 IR                | JSON compiler IR  | Wesley's language-neutral structural artifact.                               |
| Emitter              | projection        | A generator that turns compiler facts into Rust, TypeScript, or codec files. |
| Project manifest     | config file       | A JSON/YAML file that names schema sets and generic target metadata.         |
| External target      | owner of meaning  | A module, package, or sibling repo that interprets domain behavior.          |

You do not need to know Holmes, Watson, Moriarty, BLADE, realization shells, or
witness surfaces to run the compiler path below. Those are advanced assurance
and toolchain terms.

## Beginner Tutorial

Install the current release:

```bash
cargo install wesley-cli --version 0.2.0
```

When working from this checkout instead, replace `wesley` with
`cargo run --bin wesley --` in the commands below.

Create a schema:

```bash
cat > schema.graphql <<'EOF'
type User {
  id: ID!
  name: String
}

type Query {
  user(id: ID!): User
}
EOF
```

Lower it into L1 IR JSON:

```bash
wesley schema lower --schema schema.graphql --json > ir.json
```

Inspect the IR at a high level. The exact hash values will differ when the
schema changes, but the shape should include `version`, `metadata`, and
`types`:

```bash
python3 -m json.tool ir.json | sed -n '1,40p'
```

Print the schema hash:

```bash
wesley schema hash --schema schema.graphql
```

List root operations:

```bash
wesley schema operations --schema schema.graphql --json
```

Emit Rust and TypeScript:

```bash
mkdir -p generated

wesley emit rust \
  --schema schema.graphql \
  --out generated/models.rs \
  --metadata-out generated/models.rust.metadata.json

wesley emit typescript \
  --schema schema.graphql \
  --out generated/models.ts \
  --metadata-out generated/models.ts.metadata.json
```

The generated files are generic projections of GraphQL structure. They are not
database clients, web routes, runtime permissions, or application services.

Validate a project manifest:

```bash
cat > wesley.config.json <<'EOF'
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": [
    {
      "id": "app",
      "path": "schema.graphql"
    }
  ],
  "targets": [
    {
      "name": "rust-models",
      "module": "wesley.emit.rust",
      "default": true,
      "outputDir": "generated"
    }
  ]
}
EOF

wesley config validate --config wesley.config.json
wesley config inspect --config wesley.config.json --json
```

At this point you have exercised the normal compiler loop:

1. authored GraphQL in
2. deterministic IR and hashes out
3. optional generic generated artifacts out
4. external owners still responsible for runtime meaning

## Contributor Tutorial

Use this path for a small first compiler contribution. The example is a generic
emitter behavior, not a domain target.

1. Pick one Rust or TypeScript projection rule that is about GraphQL structure.
   Good first examples are scalar type mapping, nullable/list wrapping, reserved
   field-name handling, or operation binding names.
2. Add or extend a focused test in the owning emitter crate. For Rust output,
   start in `crates/wesley-emit-rust/src/lib.rs`; for TypeScript output, start
   in `crates/wesley-emit-typescript/src/lib.rs`.
3. Keep domain meaning out of the fixture. Use names such as `User`, `Post`,
   `SearchInput`, `Query`, or `Mutation`, not database, product, or runtime
   concepts.
4. Run the focused test first. Example:

   ```bash
   cargo test -p wesley-emit-rust nested_graphql_lists
   ```

5. Make the smallest change in the lowering/model/printer path that satisfies
   the test.
6. Run the crate tests and repo preflight:

   ```bash
   cargo test -p wesley-emit-rust
   pnpm run preflight
   ```

7. Update docs or `CHANGELOG.md` when the behavior changes a public command,
   emitted artifact, or contributor workflow.

If the change needs Postgres, Echo, Continuum, renderer, authentication, routing,
or runtime execution semantics, stop and move it to the owning target or sibling
repo. Wesley core should only preserve and project generic compiler facts.

## Advanced Vocabulary Boundary

Wesley also has an assurance toolchain. Its docs use terms such as Holmes,
Watson, Moriarty, BLADE, realization shells, and witness surfaces. Treat those
as advanced vocabulary. Use the
[Assurance Capability Matrix](../reference/assurance-capability-matrix.md) for
current shipped, transitional, internal-foundation, and concept-only status
instead of inferring status from page links.

Start with the compiler pages first:

- [Native CLI](./native-cli.md)
- [Schema And IR](./schema-ir.md)
- [Emitters](./emitters.md)
- [Project Manifests](./project-manifests.md)
- [Compiler Boundary](./compiler-boundary.md)
