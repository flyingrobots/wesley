# Browser Host

The browser host is a minimal, pure‑ESM adapter for running Wesley logic in a real browser bundle.

- Package: `@wesley/host-browser`
- Exports: `createBrowserRuntime()`, `runInBrowser(schema: string)`
- Design choices:
  - No Node builtins or polyfills; Web APIs only.
  - Logging via `console`.
  - Crypto via `SubtleCrypto.digest('SHA-256', …)`.
  - Clock via `Date`/`performance.now()`.
  - File I/O is an in‑memory Map (for tests/smokes).
  - Tiny SDL header detector for `@wes_table` (not full `graphql` parser) to keep the smoke dependency‑free.

Run the browser contracts

```bash
HOST=browser bats test/hosts/host-contracts.bats
```

The job builds a small Vite app, serves it, and uses Playwright to assert results.

