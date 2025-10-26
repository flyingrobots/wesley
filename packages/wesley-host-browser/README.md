# @wesley/host-browser

Pure-ESM browser host for Wesley. Provides a minimal runtime using Web APIs only (no Node built-ins) and a tiny `runInBrowser()` helper used by the browser smoke test.

- File I/O: in-memory only (for test harness)
- Logging: `console`-backed
- Crypto: `SubtleCrypto.digest('SHA-256', ...)`
- Clock: `performance.now()` / `Date`

## API

- `createBrowserRuntime(): Promise<Runtime>` – Returns a small runtime object with `logger`, `fs`, `crypto`, `clock`, and a GraphQL parser.
- `runInBrowser(schema: string)` – Runs a minimal generation pipeline with stub ports and returns an object `{ ok, token, tables }` where `token` begins with `BROWSER_SMOKE_OK:` when successful.

This package intentionally avoids Node polyfills and sets `"sideEffects": false` so bundlers can tree-shake cleanly.

