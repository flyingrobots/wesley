---
title: Holmes Counterfactual Provider Capability
legend: TRANSMUTE
packet: 0008-holmes-counterfactual-provider-capability
status: shipped
release: v0.1.0
---

# Holmes Counterfactual Provider Capability

## Scope

Move counterfactual analysis provider ownership out of generic Holmes and into
loaded Wesley modules.

## Shipped Surface

The repo now ships:

- `holmes.counterfactualProviders` in the module capability registry
- shared `wesley.config.mjs` / `WESLEY_MODULES` Node module-entry loading in
  `@wesley/runtime-node`
- a generic Holmes counterfactual dispatcher that selects the configured
  provider or the sole loaded provider
- a typed unsupported counterfactual report when no provider module is loaded
- hermetic fixture-provider coverage for the module dispatch path
- no direct `@git-stunts/*` dependencies from `@wesley/holmes`

## Playback

- Playback question: can generic Holmes run without a built-in product
  provider?
  Answer: yes. If no `holmes.counterfactualProviders` capability is loaded,
  Holmes writes a valid unsupported report instead of importing a product
  provider.
- Playback question: can a loaded module own the provider?
  Answer: yes. The fixture module registers `fixture-counterfactual`, and both
  the programmatic API and Holmes CLI consume it through normal module loading.
- Playback question: does the default policy still name `git-warp`?
  Answer: no. Counterfactual policy defaults to no provider, so the module set
  owns provider selection.

## Retrospective

- Moving shared module-entry loading into `@wesley/runtime-node` was the right
  cut. The CLI and Holmes now use the same `wesley.config.mjs` /
  `WESLEY_MODULES` semantics without putting filesystem imports in
  `@wesley/core`.
- Returning a typed unsupported report is better than treating a missing
  provider as a hard CLI crash. Counterfactuals are a readiness signal, and the
  report should explain that the provider capability is absent.
- The actual `git-warp` provider implementation was deleted from generic
  Wesley rather than parked in a package-local fixture. Recreate it only in a
  Continuum-owned module if that product lane still needs it.

## Evidence

- `packages/wesley-core/src/application/ModuleCapabilityRegistry.mjs`
- `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs`
- `packages/wesley-holmes/src/counterfactual/provider.mjs`
- `packages/wesley-holmes/test/counterfactual-provider.test.mjs`
- `packages/wesley-holmes/test/fixtures/counterfactual-provider-module.mjs`
