# Hosts and Runtimes

This page tracks retained host experiments and host-specific notes. These
packages are smoke evidence and portability probes, not the Rust-native product
spine.

## Summary

- Rust native CLI: Product front door. Compiler truth and ordinary health checks
  live in `crates/`.
- Node.js (host-node): Retired. The historical CLI wrapper and Node adapters
  were deleted during the legacy Node retirement campaign.
- Browser (host-browser): External host experiment. Pure ESM, no Node builtins;
  in-memory FS only; minimal SDL detector used in smokes.
- Deno: External host experiment. Runs a tiny self-contained SDL smoke without
  the retired JavaScript core/runtime packages.
- Bun: External host experiment. Runs a tiny self-contained SDL smoke without
  the retired JavaScript core/runtime packages.

## Contracts Suite

The unified host-contracts tests validate a small set of invariants across
retained external host experiments:

- Minimal SDL detects `@wes_table` types.
- Max schema size guard emits `EINPUTSIZE`.
- Deterministic crypto token using WebCrypto.

Commands

```bash
# Browser (Playwright under the hood)
HOST=browser bats test/hosts/host-contracts.bats

# Deno
HOST=deno bats test/hosts/host-contracts.bats

# Bun
HOST=bun bats test/hosts/host-contracts.bats
```

## Node.js (host-node)

- Status: retired.
- Notes: the historical Node wrapper, Node-specific adapters, and CLI Bats
  suites were removed. Use the native Rust `wesley` binary for product work.

## Browser (host-browser)

- Package: `packages/wesley-host-browser`
- Exports: `createBrowserRuntime()`, `runInBrowser(schema)`
- Notes:
  - No Node builtins; pure Web APIs (console, SubtleCrypto, Date, performance).
  - File I/O is in‑memory (Map) for smokes; no persistence.
  - Uses a minimal SDL detector for `@wes_table`; not full `graphql` parsing.
  - Intended as a foundation to grow a real browser‑capable parser/ports.

## Deno and Bun

- Packages: `packages/wesley-host-deno`, `packages/wesley-host-bun`
- Deno and Bun smokes import their package-local experiment entrypoints.
- Neither host experiment depends on the retired JavaScript core/runtime
  packages.

## CI

- Rust product: `.github/workflows/rust-native.yml` runs `cargo xtask preflight`
  under the `Rust Product - Native CLI` workflow name.
- Browser: `.github/workflows/browser-smoke.yml` runs the external browser host
  experiment through Playwright.
- Deno/Bun: `.github/workflows/runtime-smokes.yml` runs external host smokes.
- Node: no retained Node host package or workflow remains.

## Progress & Maturity

The repository tracks per‑package maturity (MVP → Alpha → Beta → v1.0.0) and computes an overall project stage:

- See the root README “Overall Project Status” badge and “Package Matrix” for a live view.
- Automation lives in `scripts/compute-progress.mjs` and runs nightly via `.github/workflows/progress.yml`.
- The computation considers: CI pass rate, presence of docs sections, and (in upcoming work) milestone completion, coverage, and budgets.
