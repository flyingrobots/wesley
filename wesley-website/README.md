# Wesley Website & Playground

This package (`wesley-website`) hosts the public documentation site and the **Try Wesley** in-browser playground.

## Architecture

The website is a Single Page Application (SPA) built with:

- **React 19** + **Vite**
- **Mantine UI** for components and styling
- **PGLite** (@electric-sql/pglite) for the in-browser Postgres database
- **@wesley/host-browser** for the client-side Wesley compilation engine

### The "Try Now" Playground (`/try`)

The playground allows users to experience the "Schema First" workflow without installing CLI tools.

**How it works:**

1.  **Input:** User edits GraphQL SDL in the browser.
2.  **Compile:** The `@wesley/host-browser` package (running in a Web Worker or main thread) parses the SDL and simulates the Wesley build pipeline.
3.  **Output:** It generates SQL migrations and a JSON schema bundle.
4.  **Database:** The generated SQL is applied to an in-memory **PGLite** instance (WASM-based Postgres).
5.  **Query:** Users can run real SQL queries against this ephemeral database.

**Limitations (Alpha):**

- **Non-Persistent:** Reloading the page clears the database and schema edits.
- **Single-File SQL:** The migration generation is currently a simplified simulation for the demo.
- **No Backend:** Everything runs client-side.

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev
# Open http://localhost:5173
```

## Testing

Unit tests use **Vitest**.

```bash
# Run tests
pnpm test
```

### Mocking PGLite

Tests for the playground use `FakeDbSession` (in `src/test/FakeDbSession.js`) to simulate database interactions without spinning up the full WASM Postgres engine, ensuring fast and reliable UI tests.
