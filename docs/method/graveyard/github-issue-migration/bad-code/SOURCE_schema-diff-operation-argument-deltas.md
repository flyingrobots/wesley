# Schema Diff Operation Argument Deltas

- Lane: `bad-code`
- Legend: `SOURCE`

## Why now

The native Rust `wesley schema diff` command now compares L1 schema structure,
which ports the useful generic part of the legacy Node `diff` command onto the
Rust path.

The old Node diff also reported operation/root-field argument changes. The
current Rust L1 `Field` shape does not carry field arguments, so reproducing
that behavior would either require extending the L1 IR contract or adding a
separate schema-operation analysis API.

## Hill

Wesley has an explicit Rust-owned decision for argument-aware schema deltas:
either field arguments become part of L1, or operation argument deltas live in a
separate API that does not distort the domain-empty IR.

## Done looks like

- the intended home for GraphQL field arguments is documented
- tests cover adding, removing, and changing root operation arguments
- `wesley schema diff` reports those argument deltas if they remain a Wesley
  concern
- the JSON output contract is updated without reintroducing Node as authority

## Repo Evidence

- `crates/wesley-core/src/domain/ir.rs`
- `crates/wesley-core/src/domain/schema_delta.rs`
- `crates/wesley-cli/src/main.rs`
- `docs/LEGACY_NODE_MIGRATION.md`
