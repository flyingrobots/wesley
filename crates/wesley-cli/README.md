# wesley-cli

Installs `wesley`, the command-line front end of [Wesley](https://github.com/flyingrobots/wesley#readme), a
compiler for GraphQL schemas.

```bash
cargo install wesley-cli --version 0.3.0-alpha.2
wesley doctor
```

```bash
wesley schema hash --schema shop.graphql
wesley schema diff --old shop.graphql --new shop-v2.graphql --exit-code
wesley emit rust --schema shop.graphql --out shop.rs
wesley emit typescript --schema shop.graphql --out shop.ts
```

`wesley --help` lists every command. The
[getting-started guide](https://github.com/flyingrobots/wesley/blob/main/docs/getting-started.md) walks through
them, and the [CLI reference](https://github.com/flyingrobots/wesley/blob/main/docs/cli.md) is the help output in
full.

The crate is called `wesley-cli` because `wesley` was already taken on
crates.io. The binary it installs is `wesley`.

Wesley is pre-1.0. Commands and output may change between releases. Apache-2.0.
