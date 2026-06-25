# Wesley Website

This package (`wesley-website`) hosts the public documentation site.

## Architecture

The website is a Single Page Application (SPA) built with:

- **React 19** + **Vite**
- **Mantine UI** for components and styling

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

Database helper tests use `FakeDbSession` (in `src/test/FakeDbSession.js`) to simulate database interactions without spinning up the full WASM Postgres engine, ensuring fast and reliable UI tests.
