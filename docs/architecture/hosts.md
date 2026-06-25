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

## Progress & Maturity

The repository tracks per‑package maturity (MVP → Alpha → Beta → v1.0.0) and computes an overall project stage:

- See the root README “Overall Project Status” badge and “Package Matrix” for a live view.
- Automation lives in `scripts/compute-progress.mjs` and runs nightly via `.github/workflows/progress.yml`.
- The computation considers: CI pass rate, presence of docs sections, and (in upcoming work) milestone completion, coverage, and budgets.
