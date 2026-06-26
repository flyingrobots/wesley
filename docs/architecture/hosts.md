# Hosts and Runtimes

This page tracks host-specific notes after the v0.1.1 residue purge. Host
packages are not part of the Rust-native product spine.

## Summary

- Rust native CLI: Product front door. Compiler truth and ordinary health checks
  live in `crates/`.
- Node.js (host-node): Retired. The historical CLI wrapper and Node adapters
  were deleted during the legacy Node retirement campaign.
- Browser (host-browser): Retired. No supported package, workflow, or smoke
  harness remains in Wesley.
- Deno: Retired. No supported package, workflow, or smoke harness remains in
  Wesley.
- Bun: Retired. No supported package, workflow, or smoke harness remains in
  Wesley.

## Node.js (host-node)

- Status: retired.
- Notes: the historical Node wrapper, Node-specific adapters, and CLI Bats
  suites were removed. Use the native Rust `wesley` binary for product work.

## Browser, Deno, And Bun

- Status: retired.
- Notes: the browser, Deno, and Bun smoke packages and workflows were removed
  during the v0.1.1 residue purge. Reintroduce runtime-specific behavior only
  through an explicit downstream owner or sibling repo.

## CI

- Rust product: `.github/workflows/rust-native.yml` runs `cargo xtask preflight`
  under the `Rust Product - Native CLI` workflow name.
- Browser/Deno/Bun: no retained host packages or workflows remain.
- Node: no retained Node host package or workflow remains.

## Planning Boundary

Host maturity and release scheduling are not tracked by README progress tables
or filesystem milestone docs. Use GitHub Issues, Milestones, Projects, and
version labels for live planning state.
