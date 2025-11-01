# Browser Host

The browser host is a minimal, pure‑ESM adapter for running Wesley logic in a real browser bundle.

- Package: `@wesley/host-browser`
- Exports: `createBrowserRuntime()`, `runInBrowser(schema: string)`
- Design choices:
  - No Node builtins or polyfills; Web APIs only.
  - Logging via `console`.
- Crypto via `SubtleCrypto.digest('SHA-256', …)`.
  - If `globalThis.crypto?.subtle` is unavailable (e.g., severely locked-down iframes), `sha256Hex()` throws a clear error so failures are explicit.
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

## Diagnostics & Artifacts

- OUT_JSON artifact
  - The test harness writes the host-contracts JSON to the path in `OUT_JSON` when set.
  - The browser-smoke workflow uploads this file as an artifact for debugging.
- Quick parse-only mode
  - For fast local debugging, set `ONLY_PARSE_OUT_JSON=1` and provide `OUT_JSON=path/to/file.json` to `scripts/host_contracts_browser.mjs`. The script will skip build/serve/Playwright and only parse + log diagnostics derived from the JSON content.
- Rich verifyIr diagnostics
  - When the browser IR shape check fails, stderr logs include expected/actual table counts, missing tables, missing columns, and an SDL snippet.

### Examples

Run the browser contracts and capture JSON locally:

```bash
# Install Playwright browsers once (uses cache if present)
PLAYWRIGHT_VERSION=1.43.0 pnpm dlx @playwright/test@${PLAYWRIGHT_VERSION} install --with-deps chromium

# Run the orchestrator and write OUT_JSON
OUT_JSON="/tmp/host-contracts.json" \
  node scripts/host_contracts_browser.mjs

# Inspect the JSON
jq . "/tmp/host-contracts.json"
```

Parse the JSON without rebuilding/re-running Playwright (fast diagnostics loop):

```bash
ONLY_PARSE_OUT_JSON=1 OUT_JSON="/tmp/host-contracts.json" \
  node scripts/host_contracts_browser.mjs 2> /tmp/diagnostics.log

cat /tmp/diagnostics.log
```
