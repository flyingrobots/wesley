---
title: RE-030 — Realization Integrity Guard
lane: graveyard
release: v0.1.0
---

# RE-030 — Realization Integrity Guard

## Disposition

Shipped on release/v0.1.0 through the realization-integrity guard work in commits c2bb459 and follow-on verification wiring. The pre-commit and CI gates now reject out-of-sync realization manifests instead of leaving this as pending backlog.

Replacement: `packages/wesley-cli/src/commands/verify-realization.mjs`

## Original Proposal

Legend: [RE — Runtime Engine]

## Idea

Currently, a developer can modify a GraphQL schema but forget to run `wesley compile` or `wesley generate`. This leads to "Realization Drift," where the committed source code does not match the committed derived artifacts. This poisons the "Source Sovereignty" tenet of the project.

Implement a "Realization Integrity" guard (as a pre-commit hook or CI gate). This tool should:
1. Re-hash the authored schema(s).
2. Compare the hash against the `sourceHash` stored in the committed `realization/manifest.json`.
3. Fail the commit/build if they differ, with a clear instruction to run the relevant Wesley command.

## Why

1. **Determinism**: Ensures that what is committed is always a truthful projection of the schema.
2. **Safety**: Prevents broken builds caused by stale generated code.
3. **Purity**: Enforces the "Authored Schema is Truth" invariant at the system level.

## Effort

Small — can be implemented as a simple script that reads the manifest and hashes the schema.
