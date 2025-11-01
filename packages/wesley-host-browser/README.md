# @wesley/host-browser

Pure-ESM browser host for Wesley. Provides a minimal runtime using Web APIs only (no Node built-ins) and a tiny `runInBrowser()` helper used by the browser smoke test.

## Status

Status: Experimental (Too soon for package-level CI)
![Browser Smoke](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml/badge.svg?branch=main)

- File I/O: in-memory only (for test harness)
- Logging: `console`-backed
- Crypto: `SubtleCrypto.digest('SHA-256', ...)`
- Clock: `performance.now()` / `Date`

## API

- `createBrowserRuntime(): Promise<Runtime>` – Returns a small runtime object with `logger`, `fs`, `crypto`, `clock`, and a GraphQL parser.
- `runInBrowser(schema: string)` – Runs a minimal generation pipeline with stub ports and returns `{ ok, token, tables }` where `token` begins with `BROWSER_SMOKE_OK:` when successful. The `tables` field is a number (count of detected `@wes_table` types), not an array.

### Error Handling

- Throws `TypeError` if `schema` is not a string.
- Throws `Error` if schema is larger than 1MB.
- If the underlying pipeline fails (e.g., parse error), the function resolves to `{ ok: false, token: 'BROWSER_SMOKE_FAILED', tables: 0, error }` instead of throwing.

This package intentionally avoids Node polyfills and sets `"sideEffects": false` so bundlers can tree-shake cleanly.
