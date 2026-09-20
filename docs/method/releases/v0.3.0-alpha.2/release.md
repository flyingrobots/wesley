# Wesley v0.3.0-alpha.2 Release Packet

## Summary

Wesley `0.3.0-alpha.2` puts `wesley-core`'s async lowering port behind a
default-on `resilience` feature and removes two unused dependencies, so a
consumer that needs only the synchronous compiler kernel can omit the async
runtime stack. It also pins sibling crates exactly in every published manifest,
and it is the first release prepared for the autotag workflow to tag.

It changes no IR, no hash, no CLI behavior, and no emitted artifact.

## Goalposts

1. **Lean core** (#803, landed in #804). `wesley-core` compiles without the
   async runtime stack when default features are off. Acceptance:
   `cargo xtask lean-core-check` passes inside `cargo xtask preflight`;
   `cargo tree -p wesley-core --no-default-features -e normal` names none of
   `async-trait`, `ninelives`, `tokio`, or `tower`; the default-feature public
   API is unchanged.
2. **Exact sibling pins** (#809, landed in #811). Every published crate requires
   its siblings as `=0.3.0-alpha.2`, so an unlocked install of this release
   cannot resolve siblings from a later one. Acceptance:
   `cargo xtask release-prep-guard --version 0.3.0-alpha.2` passes, and
   `cargo metadata` reports `=0.3.0-alpha.2` on every edge between published
   crates.
3. **Autotag** (#806, landed in #807). Merging the release-prep PR creates the
   annotated tag after the full release guard passes on the release commit.
   Acceptance: the `release-autotag` run for the #805 merge commit succeeds and
   `v0.3.0-alpha.2` is an annotated tag on that commit.

Retrospective and evidence live in this directory:
[`verification.md`](./verification.md).

## Scope

- **Must ship:** all three goalposts. The first is the reason the release
  exists. The second can only be fixed before publication, because published
  crates are immutable. The third is how the tag gets made.
- **May slip:** nothing.
- **Explicitly not included:** turning `resilience` off by default; any further
  reduction of the remaining 64 crates; verifying inside `release-guard` that a
  tag is annotated (#808); running every bats suite in CI (#810); the
  repository-wide markdownlint sweep (#812).

## Sponsored Users

- A downstream build-time tool that calls only `lower_schema_sdl` and
  `compute_registry_hash` to compile a GraphQL vocabulary into a generated
  descriptor. Pointed at #804 with `default-features = false`, its dependency
  tree roughly halved, its tests passed, and the artifact it generates was
  byte-identical. Reproducible counts are in [`verification.md`](./verification.md).

## Version Justification

A pre-release of the 0.3.0 line, not a patch to `0.2.0`: `0.3.0-alpha.1` is
already published and this builds on it. The change is additive for
default-feature consumers. The one observable difference is that
`--no-default-features` now has an effect, which a pre-release may introduce.
The stable `0.3.0` is not claimed.

## Non-Goals

- No change to the IR, the registry hash, schema diffing, or operation analysis.
- No change to the CLI or to any emitter.
- The `resilience` feature is not turned off by default. That would break
  consumers of the async port and belongs to a deliberate later decision.
- No reduction of the remaining 64 crates. Most arrive through `apollo-parser`,
  `chrono`, and `serde`.

## Acceptance

Each goalpost carries its own acceptance above. For the release as a whole:

- `cargo xtask preflight` passes, including `lean-core-check`.
- `cargo test -p wesley-core --no-default-features` passes every suite.
- `cargo xtask release-prep-guard --version 0.3.0-alpha.2` passes.
- `cargo xtask release-check`, `cargo audit`, and
  `cargo xtask package-crates --version 0.3.0-alpha.2` pass.

## Evidence And Fallout

- Pre-release evidence and the publish verification plan:
  [`verification.md`](./verification.md).
- If a published crate is wrong, patch forward with `0.3.0-alpha.3`; do not move
  the tag. File the defect as a GitHub issue labelled `v0.3.0` and link it from
  #803.
