# Jedit Generated Artifact Adoption

- Lane: `cool-ideas`
- Legend: `SOURCE`

## Why now

Wesley can now emit Rust and TypeScript model plus operation-binding artifacts
from the hermetic jedit hot text runtime GraphQL fixture. The next meaningful
proof is not more Wesley-side generation; it is adoption by the repos that own
the runtime.

## Hill

jedit, Echo, warp-ttd, and Continuum consume Wesley-generated artifacts as the
shared protocol surface for hot text runtime capabilities, with no handwritten
shadow models competing with the authored GraphQL schema.

## Done looks like

- jedit replaces handwritten hot text runtime shape definitions with generated
  Wesley Rust/TypeScript artifacts.
- Echo consumes either Wesley's schema operation catalog or generated Rust
  operation bindings while keeping `@wes_footprint` honesty checks Echo-owned.
- warp-ttd and Continuum treat the generated TypeScript operation bindings as
  their protocol boundary for jedit runtime operations.
- Any missing generator configurability is brought back to Wesley as a specific
  source-level requirement with a fixture and a failing test.

## Repo Evidence

- `test/fixtures/consumer-models/jedit-hot-text-runtime.graphql`
- `crates/wesley-emit-rust/src/lib.rs`
- `crates/wesley-emit-typescript/src/lib.rs`
- `crates/wesley-cli/tests/cli.rs`
- `docs/JEDIT_CAPABILITY_PROGRESS.md`
