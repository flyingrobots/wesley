---
title: Continuum Contract Release And Sync Commands
legend: TRANSMUTE
packet: 0005-continuum-contract-bundle-release-and-sync
status: active
release: v0.1.0
---

# Continuum Contract Release And Sync Commands

## Current Status

This slice was moved out of `graveyard` because it is not actually finished.
The repo now ships:

- `wesley contract release`
- `wesley contract sync`
- Continuum family and consumer metadata in `@wesley/continuum`
- bundle assembly and focused CLI coverage

That is real progress, but it does not yet satisfy the whole implementation
hill.

## Playback Status

- The release object exists. `bundle.json`, admitted source metadata,
  realization, witness output, and declared consumer projections are all
  emitted from one bundle root.
- The profile split exists. `@wesley/continuum` owns family defaults and
  consumer conventions instead of hardcoding them into the generic CLI.
- The remaining miss is on sync verification. The current `contract sync`
  command copies declared projections into a consumer repo, but it does not yet
  rerun `drift-watch` or equivalent mirror verification and fail if the
  resulting mirror still drifts.

## Remaining Work

- After sync, run bundle-aware mirror verification against the consumer repo.
- Fail `contract sync` when the consumer surface still diverges after copy.
- Only after that playback passes should this slice get a retrospective.

## Evidence

- [packages/wesley-cli/src/commands/contract.mjs](/Users/james/git/wesley/packages/wesley-cli/src/commands/contract.mjs)
- [packages/wesley-continuum/src/contract-bundle.mjs](/Users/james/git/wesley/packages/wesley-continuum/src/contract-bundle.mjs)
- [packages/wesley-cli/test/contract.bats](/Users/james/git/wesley/packages/wesley-cli/test/contract.bats)
- [packages/wesley-continuum/test/contract-bundle.test.mjs](/Users/james/git/wesley/packages/wesley-continuum/test/contract-bundle.test.mjs)

