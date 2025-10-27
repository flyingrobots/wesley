# @wesley/host-deno

Minimal Deno host for Wesley. Uses Web APIs and an in-memory FS for demos/smokes.

- API: `createDenoRuntime()`, `runInDeno(schema: string)`
- No Node builtins; works with `deno run -A`

Example

```bash
deno run -A packages/wesley-host-deno/examples/smoke.ts
```

