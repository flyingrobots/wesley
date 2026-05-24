# @wesley/host-deno

Status: Legacy compatibility surface pending externalization or deletion.

Minimal Deno host for Wesley. Uses Web APIs and an in-memory FS for
demos/smokes. This package is not on the Rust-native product path; it remains
only as compatibility evidence while the legacy Node-era host matrix is
retired.

- API: `createDenoRuntime()`, `runInDeno(schema: string)`
- No Node builtins; works with `deno run -A`

Example

```bash
deno run -A packages/wesley-host-deno/examples/smoke.ts
```
