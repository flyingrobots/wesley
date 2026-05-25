# Retired Node Host

The Node.js host was the legacy compatibility surface that composed the
historical JavaScript core with Node-specific adapters. It has been retired.
Use the native Rust `wesley` binary for product compiler work.

- Package: deleted.
- Entrypoint: deleted.
- Replacement: `cargo install --locked --path crates/wesley-cli`, then
  `wesley --help`.
- Retained JavaScript surfaces: Holmes assurance tooling and the browser, Bun,
  and Deno host experiments.

Quick checks

```bash
cargo xtask preflight
cargo wesley --help
```

Historical Node host examples belong only in migration or retrospective
contexts.
