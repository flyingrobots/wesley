# wesley-emit-codec

Part of [Wesley](https://github.com/flyingrobots/wesley#readme). Lowers Wesley's L1 IR, and the operations of a
schema, into a language-neutral plan for little-endian binary codecs: which
values are scalars, enums, nested structs, options, or lists, and in what order.

```rust
let codecs = wesley_emit_codec::plan(&ir, &operations);
```

It prints no source. `wesley-emit-rust` and `wesley-emit-typescript` both consume
this one plan and decide only how to spell it in their language, so the two
cannot disagree about the bytes on the wire. Names in the plan are the GraphQL
source names; each emitter applies its own casing.

Wesley is pre-1.0. Pin an exact version. Apache-2.0.
