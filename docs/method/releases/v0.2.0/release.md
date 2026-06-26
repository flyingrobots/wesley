# Wesley v0.2.0 Release Packet

## Summary

Wesley `0.2.0` is the domain-free project-manifest platform release. It adds a
small JSON/YAML manifest for schema sets and target metadata, a native `wesley
config` command family, manifest-driven HOLMES schema selection, descriptor-only
extension fixture modules, and comprehensive `docs/topics/` routing for current
operator and contributor workflows.

The release is still deliberately narrow. Wesley extracts structure from
GraphQL SDL and emits deterministic compiler facts; applications and extensions
assign semantics.

## Included Scope

- New `wesley.project-manifest/v1` JSON/YAML project manifest.
- Native `wesley config validate`, `wesley config inspect`, and `wesley config
changed-schemas` commands.
- Upward manifest discovery through `wesley.config.json`,
  `wesley.config.yaml`, `wesley.config.yml`, or `.wesley/config.json`.
- Single-schema manifest defaults for `schema lower`, `schema hash`, and
  `schema operations`.
- Multi-schema changed-file selection with schema-local and top-level rebuild
  globs.
- Path-safe schema IDs and isolated bundle directories for selected schema
  sets.
- Manifest-selected target metadata without built-in domain compatibility
  matrices.
- HOLMES CI schema-set matrix execution from the Wesley project manifest.
- Per-schema HOLMES bundle/report artifacts and one aggregate PR comment.
- Explicit invalid-manifest failure before fallback behavior.
- Descriptor-only extension fixture module zoo under
  `test/fixtures/extensions/fixture-zoo`.
- Contributor onramp issue routing for scoped starter work.
- Release documentation policy requiring a `docs/topics/` accuracy and coverage
  audit before tagging.
- Expanded `docs/topics/` map covering current compiler, extension, CI,
  assurance, release, documentation, and triage workflows.
- User-facing release notes, README release headline, changelog release section,
  and refreshed technical teardown.
- Workspace Rust crate version bump to `0.2.0`.

## Sponsored Users

- Maintainers of multi-schema repositories can ask Wesley which schema sets are
  affected by a change without giving Wesley domain ownership.
- HOLMES users get schema-scoped evidence artifacts and comments instead of one
  monolithic report.
- Extension authors get a current descriptor-only fixture pattern and a clear
  boundary for target metadata.
- Contributors get `docs/topics/` as the shortest current path to commands,
  boundaries, validation, release flow, and issue triage.
- Release operators get a documented `docs/topics/` audit gate and versioned
  release evidence packet.

## Version Justification

`0.2.0` is the right version for this release. Wesley is still pre-1.0, and the
release adds public CLI commands plus a new project manifest surface that other
repositories can depend on for build and CI selection. That is larger than a
patch release.

This release does not declare a stable `1.0.0` API. The project manifest and
config command family are current alpha surfaces, and later `0.x` releases may
still change them with explicit release notes.

## Non-Goals

- No stable `1.0.0` compatibility claim.
- No domain-specific Postgres, Echo, Continuum, renderer, Vite, Vue, or product
  behavior in Wesley core.
- No resurrection of the retired dynamic JavaScript `wesley.config.mjs` loader.
- No browser, Bun, Deno, website, or playground product surface.
- No executable module loading from project manifests.
- No crates.io publication evidence in this packet before the tag exists;
  publication evidence belongs in the GitHub Release, tag workflow logs, and
  registry state after the signed tag publishes.

## Acceptance

- Rust crate manifests and lockfile use version `0.2.0` for the release set.
- `CHANGELOG.md` has a dated `0.2.0` section and compare link.
- `README.md` has the exact `## What's New in v0.2.0` heading.
- `docs/TECHNICAL_TEARDOWN.md` references `v0.2.0` as the release snapshot.
- `docs/releases/v0.2.0.md` exists and includes migration guidance.
- `docs/method/releases/v0.2.0/verification.md` records validation evidence.
- `docs/topics/` has been audited at or above 90% accuracy and 90% coverage.
- `cargo xtask release-prep-guard --version 0.2.0` passes before tagging.
- `cargo xtask preflight` passes before opening or updating the PR.
- `cargo xtask release-check` passes before tagging or publishing.
- `cargo xtask package-crates --version 0.2.0` passes before tagging.
