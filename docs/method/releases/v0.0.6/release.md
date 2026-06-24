# Wesley v0.0.6 Release Packet

## Status

Superseded by [Wesley v0.1.0](../v0.1.0/release.md). This packet is retained
as planning context for the compiler-truth lane that was folded into the
pre-1.0 minor release after the TypeScript decode API break became part of the
ship scope.

## Summary

Wesley `0.0.6` is the compiler-truth release. It turns the v0.0.5 clean-house
work into executable evidence: Rust L1 fixture truth, parser acceptance
evidence, module-boundary proof, bounded tooling seams, and an archived
JS/Rust parity record that no longer acts as the release oracle.

## Included Scope

- **LE binary Rust codec emitter** (`emit le-binary-rust`), symmetric with
  `le-binary-typescript` and byte-compatible on the wire, covering enums, input
  and output objects, and operation variables; both LE binary emitters now also
  cover output `type` objects. Lets echo/jedit retire their hand-mirrored Rust
  codecs.
- Rust L1 fixture corpus expansion for directive-heavy SDL, schema extensions,
  legacy aliases, nested list type references, and invalid SDL diagnostics.
- Rust self-consistency and fixture truth as the product release gate.
- Historical JS/Rust parity scripts retained only as migration evidence while
  legacy lowerer files still exist.
- `pnpm perf:ir` Rust CLI wall-clock evidence over the valid IR corpus, plus
  optional `--include-legacy-js` comparison evidence.
- `pnpm perf:bindings` observatory evidence that separates Rust CLI, legacy JS
  in-process, future Node binding, future WASM binding, memory posture, and
  cutover criteria without choosing a production binding.
- Domain-empty core boundary proof for module-owned compile target dispatch,
  alias resolution, and generated target schema-hash agreement.
- Resilience policy boundaries using `ninelives` for Rust cooperative seams and
  `@git-stunts/alfred` for JavaScript child-process seams.

## Sponsored Users

- Rust-core maintainers can change lowering behavior and know whether they
  changed Rust L1 truth, parser acceptance, fixture goldens, or native emitter
  output.
- Module authors can rely on `wesley compile` dispatching through loaded module
  capabilities instead of built-in product/database target names.
- Echo, jedit, Continuum, `warp-ttd`, `git-warp`, and `wesley-postgres`
  maintainers get compatibility evidence without Wesley taking over their
  product, runtime, or database semantics.

## Version Justification

This remains a patch release because the public release claim is evidence,
compiler-boundary hardening, and legacy-surface retirement, not a new
product/runtime feature. The release adds maintainer-facing commands and tests
but does not intentionally break the Rust crate API.

## Explicit Non-Claims

- Legacy Node lowering is no longer a product release oracle, but the larger
  legacy package surface is not fully deleted yet.
- Rust parser/lowering spans are not claimed for semantic lowering errors.
- `pnpm perf:ir` does not define a performance threshold.
- Optional legacy JS perf comparison is not Node binding overhead, WASM
  overhead, peak RSS, or cutover proof.
- `pnpm perf:bindings` does not implement a Node-to-Rust binding, does not
  implement a WASM lowering binding, and does not authorize a production
  binding choice.
- Wesley does not own Echo, jedit, Continuum, WARPspace, `warp-ttd`,
  `git-warp`, or PostgreSQL/Supabase behavior.

## Acceptance

- `pnpm fixtures:ir` regenerates all valid Rust L1 fixture sidecars.
- `cargo xtask preflight` passes as the Rust product gate.
- `cargo test -p wesley-core` and `cargo test -p wesley-cli` pass.
- JS/Rust parity scripts, when run, are treated as archived migration evidence
  rather than release authority.
- `pnpm perf:ir -- --list-fixtures` includes the valid IR fixture corpus,
  including `nested-list-schema.graphql`.
- Optional JS comparison evidence is captured by:

  ```bash
  pnpm perf:ir -- --include-legacy-js --fixture test/fixtures/ir-parity/small-schema.graphql --iterations 1 --warmups 0
  ```

- Binding observatory evidence is captured by:

  ```bash
  pnpm perf:bindings -- --fixture test/fixtures/ir-parity/small-schema.graphql --iterations 1 --warmups 0 --json
  ```

- `cargo xtask preflight`, `pnpm run lint`, `pnpm run format:check`, and
  `git diff --check` pass before the release finalization PR is opened.
- `CHANGELOG.md`, `docs/BEARING.md`, packet `0013`, packet `0014`, packet
  `0015`, packet `0016`, and packet `0017` state exactly what is proved and
  what remains future work.
