---
title: Continuum Contract Release And Sync Commands
legend: TRANSMUTE
packet: 0005-continuum-contract-bundle-release-and-sync
status: shipped
release: v0.1.0
---

# Continuum Contract Release And Sync Commands

## Scope

Ship one generic `contract release` / `contract sync` flow that can run with
the Continuum profile, emit one versioned contract bundle with semver and exact
schema identity, and update declared consumer mirrors without handwritten copy
rules.

## Shipped Surface

The repo now ships:

- `wesley contract release`
- `wesley contract sync`
- Continuum family and consumer metadata in `@wesley/continuum`
- bundle assembly and focused CLI coverage
- post-sync consumer verification that fails if the copied surface still drifts

## Playback

- The release object exists. `bundle.json`, admitted source metadata,
  realization, witness output, and declared consumer projections are all
  emitted from one bundle root.
- The profile split exists. `@wesley/continuum` owns family defaults and
  consumer conventions instead of hardcoding them into the generic CLI.
- Sync verification now exists. After copy, `contract sync` writes a
  bundle-scoped verification report under `witness/sync-<consumer>.json` and
  fails if the consumer root still diverges from the released bundle.
- The implementation answer is deliberately bundle-aware rather than a raw
  `drift-watch` reuse. Echo's checked-in `ttd-protocol-ts` package carries
  allowed local files like `package.json` and `primitives.ts`, so byte-level
  managed-file verification plus explicit allowed-extra rules is a cleaner fit
  than pretending every consumer root is a pin-clean local mirror directory.

## Retrospective

- Reusing the release bundle as the verification source was the right cut. It
  keeps sync honest without requiring a second compile or ambient neighboring
  repo state.
- Consumer-specific local extras had to be modeled explicitly. The Echo package
  is not the same shape as a fully generated root, and the verification layer
  needed to admit that instead of treating all extras as drift.
- This closes the implementation note, but not necessarily the whole packet.
  `git-warp` still lacks a concrete declared consumer projection in this repo,
  so the broader product story around that consumer remains follow-on work.

## Evidence

- Historical implementation paths:
  `packages/wesley-cli/src/commands/contract.mjs`,
  `packages/wesley-continuum/src/contract-bundle.mjs`,
  `packages/wesley-cli/test/contract.bats`, and
  `packages/wesley-continuum/test/contract-bundle.test.mjs`.
- Current ownership note: this product-specific surface is extraction context,
  not active Wesley core doctrine.
