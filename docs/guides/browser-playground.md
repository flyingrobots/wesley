# Browser Playground Architecture

> How the "Try Wesley" in-browser playground works end-to-end.

## Overview

The playground at `/try` lets users edit GraphQL schemas, compile them to Postgres DDL, and run live SQL queries — all in the browser with zero backend. It ships as part of `wesley-website`.

## Component Map

```
┌─────────────────────────────────────────────────────┐
│  TryNow.jsx (page)                                  │
│  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │ Playground   │  │  Main Content Area           │  │
│  │ Navbar       │  │  ┌─────────────────────────┐ │  │
│  │ (file tree)  │  │  │ CodeEditor (Tiptap)     │ │  │
│  │              │  │  │ — editable for inputs   │ │  │
│  │ • inputs     │  │  │ — read-only for outputs │ │  │
│  │ • outputs    │  │  └─────────────────────────┘ │  │
│  │ • database   │  │  ┌─────────────────────────┐ │  │
│  │              │  │  │ DatabasePanel           │ │  │
│  │              │  │  │ — SQL input + Run       │ │  │
│  │              │  │  │ — results table         │ │  │
│  │              │  │  │ — schema inspector      │ │  │
│  └──────────────┘  │  └─────────────────────────┘ │  │
│                    └─────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Data Flow

1. **Input** — User edits GraphQL SDL files in the Tiptap-based `CodeEditor`. Files are held in React state as `[{ file, body }]`.

2. **Compile** — Clicking "Run Wesley" calls `compileSchemaInBrowser(inputFiles)` from `@wesley/host-browser`. This:
   - Validates and joins SDL files
   - Creates a `BrowserParserPort` (regex-based GraphQL parser)
   - Runs the `GenerationPipeline` with an in-memory file system
   - Returns `{ ok, outputFiles, tables, warnings, errors }`

3. **Output** — On success, generated artifacts (`migrations.sql`, `schema.json`) appear in the file tree as read-only output files.

4. **Apply** — Clicking "Apply to Database" splits the SQL on `;` and calls `dbSession.applyMigrations(statements)` against PGLite.

5. **Query** — The `DatabasePanel` lets users run arbitrary SQL. Results render in a Mantine `Table` with column headers from `fields` and row data from `rows`.

## Key Packages

| Package                | Role                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `wesley-website`       | React SPA, UI components, page routing                                                        |
| `@wesley/host-browser` | `compileSchemaInBrowser()`, `createBrowserRuntime()`, `BrowserParserPort`, `MemoryFileSystem` |
| `@electric-sql/pglite` | WASM-based Postgres (in-browser)                                                              |

## State Management

TryNow uses two `useReducer` instances:

- **`compileReducer`** — tracks `isCompiling`, `lastSuccess`, `errors[]`
- **`dbReducer`** — tracks `session`, `loading`, `tables[]`, `selectedTable`, `tableSchema`, `queryText`, `queryResult`, `errors[]`

Both reducers support a `RESET` action for full playground reset.

## Testing

- **`pglite.test.js`** — Integration tests against real PGLite (init, migrations, reset, row limits, error wrapping)
- **`FakeDbSession.js`** — In-memory mock implementing the `DbSession` interface for fast component tests
- **`TryNow.test.jsx`** — Component tests for workspace switching, compile flows, error display, and reset
- **`App.test.jsx`** — Routing smoke test

## Limitations (Alpha)

- **Non-persistent** — Page reload clears everything (no localStorage/IndexedDB persistence)
- **Regex parser** — `BrowserParserPort` uses regex, not a full GraphQL parser; handles common patterns but not all edge cases
- **Naive SQL splitting** — Migrations split on `;` which breaks if SQL contains semicolons inside string literals
- **No diff engine** — Every compile is "from scratch"; no incremental migration support
- **100-row limit** — `DbSession.query()` caps results at 100 rows
- **Single-threaded** — Compilation and PGLite run on the main thread (no Web Worker yet)

## Development

```bash
# Dev server
pnpm --filter wesley-website dev

# Tests
pnpm --filter wesley-website test

# Build
pnpm --filter wesley-website build
```
