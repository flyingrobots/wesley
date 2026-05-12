# Echo Footprint Directive Migration

- Lane: `bad-code`
- Legend: `SOURCE`

## Why now

Runtime optic artifacts currently use `@wes_footprint` as the authored
admission-facing footprint directive. The v0 behavior is correct: Wesley only
accepts the directive on the selected root field, compiles it into
`OpticAdmissionRequirements`, and rejects nested or scoped placements.

The spelling is still a vocabulary ownership smell. Echo or another runtime
interprets the footprint as admission policy. Wesley validates and compiles the
declared shape, but Wesley should not imply it owns runtime admission semantics.

## Hill

Plan and execute a small directive migration from `@wes_footprint` to a
runtime-owned spelling such as `@echo_footprint`, while preserving a deliberate
compatibility path for existing fixtures and consumers.

## Done Looks Like

- a migration plan states whether `@wes_footprint` remains as a legacy alias,
  warning, or removed spelling
- docs explain that Wesley compiles footprint declarations and Echo interprets
  them as admission requirements
- runtime optic tests cover the chosen compatibility behavior
- `requirements_digest` behavior is unchanged for semantically equivalent
  footprint declarations during any alias period
- nested, fragment, inline-fragment, and operation-level footprints remain
  rejected until scoped footprints are deliberately designed

## Repo Evidence

- `crates/wesley-core/src/adapters/apollo.rs`
- `crates/wesley-core/tests/runtime_optic_artifact.rs`
- `docs/SDL.md`
- `docs/NORTHSTAR.md`
