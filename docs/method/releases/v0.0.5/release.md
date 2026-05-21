# Wesley v0.0.5 Release Packet

## Summary

Wesley `0.0.5` is a clean-house release for the domain-empty compiler
direction. It closes the product-leftover cleanup packet, stabilizes obvious
IR truth drift, and prepares the repo for explicit Rust parity and module
boundary work.

## Included Scope

- Backlog cleanup for old Echo, jedit, Continuum, PostgreSQL, Supabase, and
  `v0.1.0` release-lane residue.
- Root governance docs that frame Wesley as a module-first semantic contract
  compiler and assurance toolchain.
- Product-era docs moved to historical graveyard context.
- README/progress metadata cleanup for extracted product scaffolding.
- Stable JS IR metadata for parity-sensitive bytes.
- JS object type extension folding and validation in the GraphQL adapter.
- Native Rust L1 fixture regeneration through `pnpm fixtures:ir`.
- pnpm dependency override updates that clear the release dependency audit.
- Release notes, internal release packet, and Rust crate version bump to
  `0.0.5`.

## Sponsored Users

- Wesley maintainers can pull active work without rediscovering which repo owns
  product or database concerns.
- Rust-core maintainers get a cleaner fixture and metadata base for parity
  work.
- Echo, jedit, Continuum, `warp-ttd`, `git-warp`, and `wesley-postgres`
  maintainers can treat Wesley as compatibility evidence and compiler truth,
  not as a hidden owner of their product behavior.

## Version Justification

This is a patch release because it tightens repository truth, Rust fixture
generation, and JS lowering compatibility behavior without introducing a new
public runtime feature or intentionally breaking current Rust crate APIs.

The release does change maintainer-facing behavior: `pnpm fixtures:ir` now
regenerates Rust L1 fixture outputs through the native CLI. That is compatible
with the direction of the Rust crates and appropriate for the next `0.0.x`
patch tag.

## Non-Goals

- No Echo, jedit, Continuum, `warp-ttd`, or `git-warp` product changes.
- No PostgreSQL/Supabase feature implementation in Wesley.
- No JS/Rust parity sentinel implementation in this release.
- No module capability runtime implementation in this release.
- No npm package version bump; the release tag is for the Rust/repo release
  line.

## Acceptance

- Rust crate manifests and lockfile use version `0.0.5` for the release set.
- `CHANGELOG.md` has a `0.0.5` section and compare link.
- `docs/releases/v0.0.5.md` exists and includes migration guidance.
- `docs/method/releases/v0.0.5/verification.md` records guard and validation
  evidence.
- `docs/design/0012-product-leftover-cleanup/product-leftover-cleanup.md` is
  marked shipped with playback and retrospective notes.
- Release prep guard passes for `0.0.5`.
- Package sanity passes for `0.0.5`.
- Cargo and pnpm dependency audits pass.
- Full preflight passes before opening the release finalization PR.
