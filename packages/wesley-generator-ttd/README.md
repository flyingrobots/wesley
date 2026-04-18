# @wesley/generator-ttd

Wesley generator for TTD protocol artifacts.

This package turns GraphQL SDL into the TTD-side contract surfaces Wesley
publishes today: manifest data, schema identity, protocol registries, and
language-facing artifacts for the cold-side leg.

## Usage

```bash
pnpm --filter @wesley/generator-ttd test
```

Use this package through Wesley compile and witness flows unless you are
working directly on the TTD generation pipeline.

## Status

Status: Active

MVP package with real protocol-generation coverage, but no dedicated package CI
workflow yet.
