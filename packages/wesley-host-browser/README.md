# @wesley/host-browser

Pure-ESM browser host for Wesley. Provides a minimal runtime using Web APIs only (no Node built-ins) and a `compileSchemaInBrowser()` function for compiling GraphQL schemas in the browser.

## Status

Status: Legacy compatibility surface pending externalization or deletion.
![Browser Smoke](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml/badge.svg?branch=main)

This package is not on the Rust-native product path. It remains only as
compatibility evidence while the legacy Node-era host matrix is retired or moved
to external ecosystem ownership.

- File I/O: in-memory only (for test harness)
- Logging: `console`-backed
- Crypto: `SubtleCrypto.digest('SHA-256', ...)`
- Clock: `performance.now()` / `Date`

## API

- `createBrowserRuntime(): Promise<Runtime>` – Returns a small runtime object with `logger`, `fs`, `crypto`, `clock`, and a GraphQL parser.
- `compileSchemaInBrowser(inputFiles)` – Compiles GraphQL schema files into SQL migrations. Takes an array of `{ file: string, body: string }` objects and returns a result object.

### compileSchemaInBrowser

```javascript
const result = await compileSchemaInBrowser([
  { file: 'schema.graphql', body: 'type User @wes_table { id: ID! @wes_pk name: String! }' }
]);
// result: { ok: boolean, outputFiles: Array<{file, body}>, tables: number, warnings: string[], errors: Array<{message, location?}> }
```

### Error Handling

- Throws `TypeError` if `inputFiles` is not an array.
- Throws `Error` if combined schema is larger than 1MB.
- If the underlying pipeline fails (e.g., parse error), returns `{ ok: false, outputFiles: [], tables: 0, warnings: [], errors: [...] }` instead of throwing.

This package intentionally avoids Node polyfills and sets `"sideEffects": false` so bundlers can tree-shake cleanly.
