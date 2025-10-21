# @wesley/generator-js

Code generation helpers that turn Wesley IR into JavaScript/TypeScript artifacts:

- `model.mjs` – Plain JS model emitters.
- `typescript.mjs` – TypeScript typings, interfaces, and utility types.
- `zod.mjs` – Zod schema generation for runtime validation.

## Development

This package is currently consumed by `wesley-host-node`; stand-alone CLIs are forthcoming.

Run tests (once added) using the workspace filter:

```bash
pnpm --filter @wesley/generator-js test
```

## Status

Foundational building blocks. Unit tests and CLI wiring are tracked on the roadmap.
