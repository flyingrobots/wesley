# Retired: Refactor lowerer to optic engine

## What was retired

The ASAP backlog item `OWN_refactor-lowerer-to-optic-engine.md` was retired.

## Why

The card described a broad terminology and implementation jump from
`LoweringPort` to a `WarpOptic` trait, recursive WARP graph state, and DPO
transformations. That is not a narrow Wesley cleanup slice and is not backed by
the current Rust parity plan.

The clean-house release is about making the current compiler boundary honest,
not relabeling the compiler kernel as a runtime.

## Reopen condition

Reopen only with a concrete IR/API decision, failing tests, and a scoped design
packet that explains why the current lowering trait cannot represent the needed
compiler behavior.
