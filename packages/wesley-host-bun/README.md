# @wesley/host-bun

Minimal Bun host for Wesley. Pure ESM, in-memory FS, WebCrypto.

- API: `createBunRuntime()`, `runInBun(schema: string)`

## API

- `createBunRuntime(): Promise<Runtime>`
  - Returns a small runtime with `{ logger, fs, clock, crypto, parsers }` suitable for smoke tests.

- `runInBun(schema: string): Promise<{ ok: boolean; token: string; tables: number }>`
  - Runs a minimal generation pipeline and returns an object where:
    - `ok`: true on success
    - `token`: a string beginning with `BUN_HOST_OK:` followed by a short SHA-256 digest
    - `tables`: number of tables discovered in the schema
  - Errors/throws:
    - Throws `TypeError` if `schema` is not a string (future-proofing; current smoke assumes a string)
    - Throws if WebCrypto (`crypto.subtle`) is unavailable in this runtime

### Usage

```js
import { runInBun } from '@wesley/host-bun';

const sdl = /* GraphQL * / `
  type Org @wes_table { id: ID! @wes_pk }
  type User @wes_table { id: ID!, org_id: ID! @wes_fk(ref: "Org.id") }
`;

const res = await runInBun(sdl);
if (res.ok) {
  console.log(res.token); // e.g. BUN_HOST_OK:2:1a2b3c4d5e6f
}
```

Example

```bash
bun run packages/wesley-host-bun/examples/smoke.mjs
```
