<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# @wesley/generator-echo

Wesley generator for **Echo/WARP** artifacts.

This package turns GraphQL SDL into a deterministic "Echo IR" (`echo-ir/v2`) and a complete set of host-side artifacts (TypeScript + Rust), all produced in a single one-pass codegen profile.

## Input

`generateEcho({ sdl })` requires a **GraphQL SDL string**.

Notes:
- `ir` can be provided, but `sdl` is still required because the op catalog is derived from SDL.
- The generator throws if `sdl` is missing/empty.

## Output

Returns:

```js
{
  files: [
    { path: "ir.json", content: "{ ... }" },
    { path: "ops.generated.ts", content: "..." },
    { path: "schemas.generated.ts", content: "..." },
    { path: "client.generated.ts", content: "..." },
    // Conditional (when IR has encodable types):
    { path: "raw_le_codec.generated.ts", content: "..." },
    { path: "raw_le_codec.generated.rs", content: "..." },
    // Conditional (when IR has @wes_join directives):
    { path: "join.generated.rs", content: "..." },
    // Conditional (when IR has @wes_view directives):
    { path: "guarded_views.generated.rs", content: "..." },
    // Always emitted (WASM ABI boundary codecs):
    { path: "wasm_abi_codec.generated.rs", content: "..." },
    { path: "wasm_abi_codec.generated.ts", content: "..." }
  ],
  profile: {
    name: "app",
    targets: { ir: [...], typescript: [...], rust: [...] },
    artifact_count: 10  // varies by schema (6 always + 4 conditionals max)
  }
}
```

All artifacts are emitted from a single shared IR in one deterministic pass — no duplicate intermediate transforms.

### Host helper outputs

- **`ops.generated.ts`**: exports `CONTRACT_VERSION`, `SCHEMA_SHA256`, `CODEC_ID`, `REGISTRY_VERSION`, `OPS`, and `findOpId(kind, name)`
- **`schemas.generated.ts`**: Zod schemas for types (enums + objects), per-op `VarsSchema` and `ResultSchema`, and `OP_SCHEMAS` registry map
- **`client.generated.ts`**: self-contained TypeScript runtime client with:
  - `HANDSHAKE` constants (contract version, schema hash, codec, registry version)
  - `WesleyClient` class with typed `dispatch()` and `query()` methods
  - `createPump()` for view-op envelope parsing and routing
  - `parseViewOps()` for binary envelope decoding
  - `DiagnosticsChannel` for unknown op / decode error surfacing
- **`raw_le_codec.generated.ts`**: browser-safe binary encode/decode per type (DataView/Uint8Array)
- **`raw_le_codec.generated.rs`**: Rust binary encode/decode per type (byte-identical to TS codec)
- **`wasm_abi_codec.generated.rs`**: Rust encode/decode for WASM ABI response types (`DispatchResponse`, `StepResponse`, `DrainResponse`, `RegistryInfo`, `AbiError`) with binary envelope (`encode_ok`/`encode_err`/`decode_envelope`)
- **`wasm_abi_codec.generated.ts`**: TypeScript encode/decode for WASM ABI response types with `AbiResult<T>` type, `decodeEnvelope()` generic decoder, and per-response-type convenience decoders

### Plugin usage

For plugin-based invocation via `PluginRunner`:

```js
import { EchoPlugin } from '@wesley/generator-echo';

const plugin = new EchoPlugin();
plugin.init({ mutationIdNamespace: 'Mutation', queryNamespace: 'Query' });
```

### Contract versioning

Generated artifacts include a `contract_version` field (semver) in the IR and emitted files. The version bump policy:

- **Major** — envelope wire format, op ID hashing, or codec field ordering changes
- **Minor** — new optional IR fields, new artifact files, or new metadata in generated TS
- **Patch** — bug fixes, comment changes, or internal refactors with identical output

### Op ID derivation (frozen rule)

Each operation gets a persisted numeric ID:

- `op_id = sha256("${namespace}:${opName}").readUInt32LE(0)`

Namespaces default to:
- `Mutation` for mutations
- `Query` for queries

The `ops[]` list is sorted alphabetically by name. Types in the IR are also sorted alphabetically for deterministic output independent of SDL declaration order.

## Dev

Run tests:

```bash
pnpm --filter @wesley/generator-echo test
```
