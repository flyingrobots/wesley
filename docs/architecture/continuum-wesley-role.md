# Retired Wesley Role In Continuum

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This note is retained as historical extraction context only. It is not the
current operating role of Wesley, and it must not be used to schedule generic
Wesley work.

The current Wesley invariant is domain-free:

```text
Wesley extracts the structure described by GraphQL and provides hooks for
external extensions to give that structure semantics.
```

There is no generic Wesley role called "Continuum contract compiler",
"Continuum publication-boundary manager", or "Continuum judgment bridge".
Those were product-lane ideas from an older design. They may still be valuable
inside Continuum, but they are not generic Wesley commitments.

## What Wesley Owns Now

Wesley owns:

- GraphQL SDL parsing and validation.
- Deterministic L1 IR and canonical hashes.
- Generic operation catalogs, selection facts, directive payloads, and
  operation artifacts.
- Extension points where external modules can attach domain meaning.
- Evidence that the compiler produced a specific structure from specific
  input.

Wesley does not own:

- Continuum runtime, observer, receipt, settlement, or publication semantics.
- Echo runtime or CAS semantics.
- `warp-ttd` debugger and playback semantics.
- Product-specific package defaults such as a Wesley-owned Continuum profile.
- Runtime authority, admission, or deployment policy for downstream systems.

## Current Split

If Continuum needs a compiler lane, Continuum owns the lane. The correct
shape is:

```text
Continuum-authored schema or directives
  -> Wesley domain-free compiler and IR
  -> Continuum-owned module interprets the result
  -> Continuum-owned runtime, package, or release surface
```

Wesley may be useful in that chain, but it does not become Continuum-aware by
participating in it.

## Historical Pointers

The historical product-lane context remains in:

- [Continuum Minimum Shared Contract Surface](./continuum-minimum-shared-contract-surface.md)
- [Continuum Contract Compiler](../design/0003-continuum-contract-compiler/continuum-contract-compiler.md)
- [0003 Retro](../method/retro/0003-continuum-contract-compiler/continuum-contract-compiler.md)
