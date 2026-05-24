# Wesley v0.0.6 Release Packet

## Summary

Wesley `0.0.6` is the compiler-truth release. It turns the v0.0.5 clean-house
work into executable evidence: Rust L1 fixture truth, JS/Rust parity
projections, parser acceptance evidence, module-boundary proof, and bounded
tooling seams.

## Included Scope

- Rust L1 fixture corpus expansion for directive-heavy SDL, schema extensions,
  legacy aliases, nested list type references, and invalid SDL diagnostics.
- `pnpm parity:ir` for explicit JS/Rust projection parity over the default v0
  corpus.
- `js-table-vs-rust-table.v0` and
  `js-sdl-type-family-vs-rust-l1-type-family.v0` as named parity projections.
- `pnpm parity:parser` for parser/lowerer acceptance evidence over valid,
  syntax-invalid, and duplicate-directive fixtures.
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
  changed Rust L1 truth, projection parity, parser acceptance, or fixture
  goldens.
- Module authors can rely on `wesley compile` dispatching through loaded module
  capabilities instead of built-in product/database target names.
- Echo, jedit, Continuum, `warp-ttd`, `git-warp`, and `wesley-postgres`
  maintainers get compatibility evidence without Wesley taking over their
  product, runtime, or database semantics.

## Version Justification

This remains a patch release because the public release claim is evidence and
compiler-boundary hardening, not a new product/runtime feature. The release
adds maintainer-facing commands and tests but does not intentionally break the
Rust crate API or retire legacy Node lowering.

## Explicit Non-Claims

- Legacy Node lowering is not retired.
- Rust parser/lowering spans are not claimed for semantic lowering errors.
- `pnpm perf:ir` does not define a performance threshold.
- Optional legacy JS perf comparison is not Node binding overhead, WASM
  overhead, peak RSS, or cutover proof.
- `pnpm perf:bindings` does not implement a Node-to-Rust binding, does not
  implement a WASM lowering binding, and does not authorize legacy JS lowering
  retirement.
- Wesley does not own Echo, jedit, Continuum, WARPspace, `warp-ttd`,
  `git-warp`, or PostgreSQL/Supabase behavior.

## Acceptance

- `pnpm fixtures:ir` regenerates all valid Rust L1 fixture sidecars.
- `pnpm parity:ir` passes the explicit default v0 projection corpus.
- `pnpm parity:parser` passes the explicit parser-sensitive corpus.
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

- `node --test packages/wesley-cli/test/module-loading.test.mjs` proves the
  fixture-module zoo boundary, including multi-module alias resolution and
  schema-hash mismatch rejection.
- `pnpm run preflight`, `pnpm run lint`, `pnpm run format:check`, and
  `git diff --check` pass before the release finalization PR is opened.
- `CHANGELOG.md`, `docs/BEARING.md`, packet `0013`, packet `0014`, packet
  `0015`, and packet `0016` state exactly what is proved and what remains
  future work.
