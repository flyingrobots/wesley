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

## Bundler Notes & Budgets

- Examples in-repo
  - Vite (contracts harness): `test/browser/contracts/vite.config.mjs`
  - Vite (smoke harness): `test/browser/smoke/vite.config.mjs`
- Bundle size budget
  - CI enforces a total JS size budget for the contracts harness (default 50KB).
  - Override with `BUNDLE_MAX_KB=<number>` in the workflow/job environment.
- Tips
  - Keep the browser host pure ESM; avoid Node polyfills and heavy deps.
  - Prefer small, purpose-built parsers/adapters over general libs where possible.
  - Verify tree-shaking: `"sideEffects": false` in `@wesley/host-browser`.
