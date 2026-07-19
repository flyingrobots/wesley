# Extension Generation Contract

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this reference when a Rust crate outside Wesley needs canonical Shape/Law
facts for deterministic code or metadata generation without invoking the
`wesley` CLI.

## Ownership Boundary

Wesley owns the domain-neutral input and provenance envelopes. The external
generator owner supplies and interprets domain declarations, generator
settings, projection roles, target semantics, and generated output schemas.
Wesley does not discover source files, resolve registries, execute targets, or
assign runtime meaning to those values.

The public contract lives in `wesley-core`:

| Rust API                         | Role                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ExtensionGenerationInputV1`     | Canonical Shape IR, normalized root operations, optional bound Law IR, owner declarations, settings digest, and requested roles. |
| `GenerationArtifactReferenceV1`  | Owner-defined coordinate plus the exact SHA-256 digest of referenced bytes.                                                      |
| `GeneratorIdentityV1`            | Generator coordinate, release version, and exact executable or component digest.                                                 |
| `GenerationProvenanceManifestV1` | Binding from generator and canonical input to exact source and emitted artifacts.                                                |
| `GenerationReviewV1`             | Derived deterministic JSON for review; `authoritative` is always `false`.                                                        |

The corresponding JSON Schemas are:

- `schemas/wesley-extension-generation-input-v1.schema.json`
- `schemas/wesley-generation-provenance-manifest-v1.schema.json`
- `schemas/wesley-generation-review-v1.schema.json`

## Data Flow

The generation boundary receives only explicit in-memory values. Exact bytes
are supplied again to provenance verification rather than rediscovered.

```text
canonical Wesley Shape IR + normalized operations
                         + optional validated Law IR
                         + owner artifact references
                         + settings digest + requested roles
                                      |
                                      v
                     ExtensionGenerationInputV1
                                      |
                         external owner generator
                                      |
                                      v
                     emitted artifacts + exact digests
                                      |
                                      v
                 GenerationProvenanceManifestV1
                                      |
                         recompute every exact byte
                                      |
                    verified receipt + derived review
```

## Canonicalization And Identity

`ExtensionGenerationInputV1::new` strips `WesleyIR.metadata`, including source
paths and generation timestamps. It preserves Wesley's established canonical L1
ordering, normalizes the operation catalog, removes Law IR authoring paths and
prose, normalizes Law IR set-like values, and sorts owner references and
projection roles. Conflicting digests for one coordinate fail with
`WESLEY_GENERATION_COORDINATE_DIGEST_CONFLICT`.

Input and provenance identities use domain-separated SHA-256 over canonical
JSON bytes. Artifact, generator, and settings references use exact
`sha256:<lowercase-hex>` byte digests. Provenance verification independently
recomputes the generator, every source, and every output digest and rejects
missing, unexpected, or mismatched material with structured error kinds.

## Non-Authority Rules

- `GenerationReviewV1` is derived from canonical input and provenance. Its
  schema requires `authoritative: false`.
- A decoded or schema-valid target artifact is not thereby semantically valid.
  The external owner remains responsible for its output schema and semantic
  verifier.
- A provenance manifest proves exact generation inputs and outputs. It does not
  prove that a target runtime enforces the generated claims.
- No API in this contract reads the filesystem, environment, clock, network,
  package registry, or process state.

## Runnable Example: IR To Brainfuck

For an end-to-end external-generator example with appropriately questionable
target-language judgment, run:

```text
cargo run --quiet -p wesley-core --example ir_to_brainfuck
```

Cargo compiles an example target as a separate crate, so
`crates/wesley-core/examples/ir_to_brainfuck.rs` consumes only the public
`wesley-core` API. It lowers a small GraphQL schema, derives a deterministic
summary from canonical Shape IR and normalized root operations, compiles that
summary into Brainfuck, executes the program, and verifies the exact owner
declaration, generator component, and emitted program bytes. The playback also
prints the input and provenance digests and confirms that the review projection
is non-authoritative.

Emit the complete Brainfuck source instead of running the human-readable
playback with:

```text
cargo run --quiet -p wesley-core --example ir_to_brainfuck -- --source
```

The example is educational evidence for the external-generation contract. Its
compiler and interpreter remain owned by the separate example crate; the public
`wesley-core` library and `wesley` CLI gain no plugin discovery, target-execution,
Brainfuck-semantics, or command surface.

## Verification

Run the focused executable contract and fixture checks with:

```text
cargo test -p wesley-core --test extension_generation
cargo test -p wesley-core --example ir_to_brainfuck
```

The integration test is compiled as an external Rust crate against only the
public `wesley-core` API. Checked fixtures under
`test/fixtures/extension-generation/` are compared with canonical output and
validated against the published schemas. `cargo xtask test` and
`pnpm run preflight` also execute the Brainfuck example tests so the shipped
playback cannot silently drift.
