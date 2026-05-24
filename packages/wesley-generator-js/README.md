# @wesley/generator-js

Status: Legacy compatibility surface pending deletion or externalization.
![pkg-generator-js](https://github.com/flyingrobots/wesley/actions/workflows/pkg-generator-js.yml/badge.svg?branch=main)

Historical generation helpers that turn legacy Wesley IR into
JavaScript/TypeScript artifacts:

- `model.mjs` – Plain JS model emitters.
- `typescript.mjs` – TypeScript typings, interfaces, and utility types.
- `zod.mjs` – Zod schema generation for runtime validation.

## Development

This package is currently consumed by `wesley-host-node`. For retained generic
TypeScript output, use the native Rust emitter:

```bash
wesley emit typescript --schema schema.graphql --out generated/types.ts
```

Zod and richer JavaScript-specific output should move to an external target
module or owning package when a consumer needs it.

Run tests (once added) using the workspace filter:

```bash
pnpm --filter @wesley/generator-js test
```

## Status

Compatibility building blocks. Unit tests and CLI wiring remain only to keep
legacy package behavior honest during the retirement campaign.
