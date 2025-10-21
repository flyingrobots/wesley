# @wesley/generator-supabase

Supabase-specific generators that extend the core Wesley emission pipeline with Supabase conventions (RLS helpers, realtime config, storage policies).

## Key Modules

- `src/index.mjs` – Entry point that wires Supabase emitters into the host runtime.
- `TestDepthStrategy.mjs` – Shared helper used by tests to scale snapshot assertions based on scenario depth.
- `test/` – Unit and integration coverage for Supabase artefacts.

## Development

```bash
pnpm --filter @wesley/generator-supabase test
```

## Status

Actively maintained as the canonical Supabase adapter.
