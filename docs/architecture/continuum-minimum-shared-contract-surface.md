# Retired Continuum Minimum Shared Contract Surface

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This note is retained as historical extraction context only. It is not an
active Wesley contract surface, and it must not be read as a current promise
that generic Wesley knows how to compile, witness, or package Continuum,
Echo, or `warp-ttd` noun families.

Generic Wesley has no current Continuum-specific minimum shared contract
surface. Wesley's current invariant is narrower:

```text
GraphQL SDL -> deterministic Wesley IR -> external modules assign meaning.
```

If a future Continuum surface is still useful, it belongs in a
Continuum-owned module or repository. That module may call Wesley as a
domain-free compiler and may consume Wesley IR, operation facts, emitted
artifacts, or witness-friendly evidence. It owns the Continuum semantics,
runtime policy, package shape, and release surface.

## Retired Assumptions

The older version of this note treated these as Wesley-local facts:

- `compile-ttd` and `bundle-echo` product commands.
- A repo-local Continuum shared contract surface.
- A repo-local Echo/TTD witness lane.
- Wesley-side Continuum package defaults.
- Continuum receipt and settlement families as Wesley-scheduled product work.

Those assumptions are no longer active Wesley doctrine. They were retired by
the domain-empty extraction and the v0.1.1 residue purge.

## Current Rule

- Wesley core owns GraphQL SDL parsing, validation, lowering, deterministic IR,
  generic operation facts, and extension hooks.
- Continuum owns Continuum schemas, directives, runtime policy, observer
  semantics, packaging, and product release meaning.
- Echo owns Echo runtime and CAS semantics.
- `warp-ttd` owns debugger and playback semantics.
- Any current or future cross-project contract family must enter Wesley through
  an explicit external module or input contract, not through baked-in Wesley
  product knowledge.

## Historical Pointers

The historical Continuum design context remains in:

- [Continuum Contract Compiler](../design/0003-continuum-contract-compiler/continuum-contract-compiler.md)
- [0003 Retro](../method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md)
- [Product Leftover Cleanup](../design/0012-product-leftover-cleanup/product-leftover-cleanup.md)
