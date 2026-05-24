# Hosts and Runtimes

This page tracks historical host compatibility surfaces and host-specific
notes. These packages are compatibility evidence during Node retirement, not
the Rust-native product spine.

## Summary

- Rust native CLI: Product front door. Compiler truth and ordinary health checks
  live in `crates/`.
- Node.js (host-node): Legacy compatibility. Historical CLI and adapters live
  here until deletion.
- Browser (host-browser): Legacy compatibility. Pure ESM, no Node builtins;
  in-memory FS only; minimal SDL detector used in smokes.
- Deno: Legacy compatibility. Imports `@wesley/core` through compatibility
  harnesses only.
- Bun: Legacy compatibility. Imports `@wesley/core` through compatibility
  harnesses only.

## Contracts suite (multi‑host)

The unified “host contracts” tests validate a small set of invariants across all hosts:

- Minimal SDL detects `@wes_table` types.
- Max schema size guard emits `EINPUTSIZE`.
- Deterministic crypto token using WebCrypto.

Commands

```bash
# Node
HOST=node bats test/hosts/host-contracts.bats

# Browser (Playwright under the hood)
HOST=browser bats test/hosts/host-contracts.bats

# Deno
HOST=deno bats test/hosts/host-contracts.bats

# Bun
HOST=bun bats test/hosts/host-contracts.bats
```

## Node.js (host-node)

- Package: `packages/wesley-host-node`
- Entrypoint: `packages/wesley-host-node/bin/wesley.mjs`
- Notes: All Node‑specific adapters (fs, child_process, pino logging) live here. CLI Bats suites provide deep coverage.

## Browser (host-browser)

- Package: `packages/wesley-host-browser`
- Exports: `createBrowserRuntime()`, `runInBrowser(schema)`
- Notes:
  - No Node builtins; pure Web APIs (console, SubtleCrypto, Date, performance).
  - File I/O is in‑memory (Map) for smokes; no persistence.
  - Uses a minimal SDL detector for `@wes_table`; not full `graphql` parsing.
  - Intended as a foundation to grow a real browser‑capable parser/ports.

## Deno and Bun

- No dedicated host packages yet; smokes import `@wesley/core` directly.
- Deno uses `deno.json` import maps to resolve `@wesley/core` to source.
- Bun runs ESM sources directly.

## CI

- Rust product: `.github/workflows/rust-native.yml` runs `cargo xtask preflight`
  under the `Rust Product - Native CLI` workflow name.
- Browser: `.github/workflows/browser-smoke.yml` runs compatibility contracts
  through Playwright under a `Legacy Compatibility` workflow name.
- Deno/Bun: `.github/workflows/runtime-smokes.yml` runs compatibility contracts
  with `HOST=deno` and `HOST=bun`.
- Node: the same compatibility workflow includes `HOST=node`; package workflows
  keep historical Node-host behavior honest until deletion.

## Progress & Maturity

The repository tracks per‑package maturity (MVP → Alpha → Beta → v1.0.0) and computes an overall project stage:

- See the root README “Overall Project Status” badge and “Package Matrix” for a live view.
- Automation lives in `scripts/compute-progress.mjs` and runs nightly via `.github/workflows/progress.yml`.
- The computation considers: CI pass rate, presence of docs sections, and (in upcoming work) milestone completion, coverage, and budgets.
