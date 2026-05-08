# CRATES.IO RELEASE
<!-- docs-truth: status=experimental owner=@flyingrobots -->

Wesley's native Rust distribution path is crates.io.

The first alpha package set is:

| Package | Publishes | Purpose |
| --- | --- | --- |
| `wesley-core` | library | GraphQL lowering, schema hashing, schema diffing, operation analysis, and directive data extraction. |
| `wesley-emit-rust` | library | Rust model and operation-binding projection from Wesley IR. |
| `wesley-emit-typescript` | library | TypeScript declaration and operation-binding projection from Wesley IR. |
| `wesley-cli` | binary package | Installs the `wesley` command. |

The bare `wesley` crate name is already occupied on crates.io, so the
installable package is `wesley-cli`:

```bash
cargo install wesley-cli --version 0.0.1
wesley --help
```

## Release Rules

- Do not publish from a dirty worktree.
- Do not use `--allow-dirty` for a real publish.
- Publish crates in dependency order.
- Expect dependent dry-runs to fail until their internal Wesley dependencies
  have already reached the crates.io index.
- Do not use sibling-repo paths as the distribution story. `path` dependencies
  in `Cargo.toml` are local workspace conveniences paired with exact crate
  versions for publication.

## First Alpha Publish Sequence

Run repository verification first:

```bash
cargo test --workspace
cargo xtask release-check
```

Publish in this order:

```bash
cargo publish -p wesley-core
cargo publish -p wesley-emit-rust
cargo publish -p wesley-emit-typescript
cargo publish -p wesley-cli
```

If a dependent crate reports that an internal Wesley dependency cannot be found
on crates.io, wait for the crates.io index to catch up and retry the same
publish command.

After `wesley-cli` is published, verify installation from the public package:

```bash
cargo install wesley-cli --version 0.0.1
wesley --help
```
