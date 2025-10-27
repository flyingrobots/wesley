# Hosts and Runtimes

This page tracks where Wesley runs today and any host‑specific notes.

## Summary

- Node.js (host-node): Stable. Full CLI and adapters live here.
- Browser (host-browser): Experimental. Pure ESM, no Node builtins; in‑memory FS only; minimal SDL detector used in smokes.
- Deno: Smoke coverage. Imports `@wesley/core` via `deno.json` import map; no dedicated host package yet.
- Bun: Smoke coverage. Imports `@wesley/core`; no dedicated host package yet.

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

- Browser: `.github/workflows/browser-smoke.yml` runs the contracts via Playwright.
- Deno/Bun: `.github/workflows/runtime-smokes.yml` runs the contracts with HOST=deno and HOST=bun.
- Node: same workflow includes HOST=node; in addition, CLI workflows provide deep coverage.

