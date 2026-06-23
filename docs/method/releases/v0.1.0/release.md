# Wesley v0.1.0 Release Packet

## Summary

Wesley `0.1.0` is the LE-binary codec-plan release. It unifies Rust and
TypeScript LE-binary codec emitters behind the shared `wesley-emit-codec` plan
and ships the TypeScript decode result boundary required to make codec failures
explicit.

The release supersedes the patch-shaped `v0.0.6` lane for the work in this
branch because TypeScript generated decode signatures now change publicly.

## Included Scope

- New `wesley-emit-codec` crate with shared LE-binary `CodecDef`, `CodecOp`,
  `FieldPlan`, scalar, and struct-kind planning.
- Rust LE-binary emitter consumption of the shared plan.
- TypeScript LE-binary emitter consumption of the shared plan without golden
  output drift during the pure refactor slice.
- Rust trailing-byte rejection for top-level decode, closing #603 for Rust.
- TypeScript public decode wrappers returning `Result<T>`.
- TypeScript single catch-at-boundary decode helper that converts thrown codec
  failures into `err`.
- TypeScript trailing-byte rejection for top-level decode, closing #603 for
  TypeScript.
- Generated `Writer`, `Reader`, and `CodecError` runtime port contracts.
- Regenerated Rust and TypeScript LE-binary codec golden fixtures.
- Workspace Rust crate version bump to `0.1.0`.
- User-facing release notes and changelog release section.

## Sponsored Users

- Echo and jedit maintainers get one shared Wesley codec shape instead of
  language-specific generator drift.
- TypeScript runtime maintainers get an explicit result boundary and a visible
  `Reader.remaining()` requirement.
- Rust runtime maintainers keep the existing `Result<T, CodecError>` style and
  gain an emitted runtime-port contract to compare against.
- Wesley maintainers get focused codec-plan tests and regenerated goldens for
  both LE-binary emitters.

## Version Justification

`0.1.0` is the right version for this release. The project is still pre-1.0, so
SemVer permits incompatible API changes in a minor release. A patch release
would be misleading because generated TypeScript decode signatures move from
raw `T` to `Result<T>`.

This release does not claim a stable `1.0.0` public API. The codec plan is a
cleaner compiler boundary, but the wider Wesley API surface is still alpha and
the Holmes law-assurance substrate remains in active development.

## Non-Goals

- No stable `1.0.0` compatibility claim.
- No new wire-format encoding for existing LE-binary values.
- No domain-specific Echo, jedit, Continuum, PostgreSQL, or Supabase behavior.
- No replacement of the hand-rolled emitter printers with a full third-party
  language AST framework.
- No crates.io publication in this packet; publication evidence belongs in
  `verification.md` when the tag/release is cut.

## Acceptance

- Rust crate manifests and lockfile use version `0.1.0` for the release set.
- `CHANGELOG.md` has a dated `0.1.0` section and compare link.
- `README.md` has an exact `## What's New in v0.1.0` heading.
- `docs/releases/v0.1.0.md` exists and includes migration guidance.
- `docs/method/releases/v0.1.0/verification.md` records validation evidence.
- TypeScript LE-binary golden changes are intentional and show `Result<T>`,
  runtime ports, and trailing-byte rejection.
- Rust LE-binary golden changes are intentional and show runtime port
  contracts.
- `cargo xtask preflight` passes before opening or updating the PR.
- `cargo xtask release-check` passes before tagging or publishing.
- `cargo xtask release-prep-guard --version 0.1.0` passes before cutting the
  release.
