# Parity Sentinel Archive

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This note closes the active release-gate role of the JS/Rust parity sentinels.
The scripts remain available as migration evidence while legacy packages still
exist, but they no longer define whether Rust Wesley is releasable.

## Current Authority

Rust self-consistency is the product gate:

- Rust L1 fixture goldens define expected compiler facts.
- `cargo xtask preflight` is the ordinary product health check.
- Native `wesley schema lower`, `schema hash`, `schema diff`, and `emit`
  commands are the public product surface.
- Legacy JS parity scripts are compatibility and archaeology tools.

## Archived Migration Evidence

| Surface              | Historical role                              | Current role                                                                |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm parity:ir`     | Compared selected JS and Rust IR projections | Optional migration evidence while legacy JS lowerer files still exist.      |
| `pnpm parity:parser` | Compared parser/lowerer acceptance outcomes  | Optional acceptance archaeology for legacy fixtures.                        |
| `pnpm perf:ir`       | Measured Rust CLI and optional JS lowerer    | Retired; use `cargo xtask bench-ir` for current Rust CLI baseline evidence. |
| `pnpm perf:bindings` | Named future binding cutover report slots    | Observatory evidence only; it does not authorize a binding choice.          |

## Retirement Rule

Do not use the legacy JS lowerer as a permanent oracle. During deletion work,
copy useful fixture cases into Rust tests or plain fixture goldens, then delete
the JS package surface when all remaining behavior is ported, extracted, or
explicitly rejected.
