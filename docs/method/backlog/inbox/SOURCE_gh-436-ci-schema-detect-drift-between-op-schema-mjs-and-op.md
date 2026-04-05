# GH-436 ci(schema): detect drift between op.schema.mjs and op.schema.json

- Imported from: GitHub issue
- Issue: #436
- URL: https://github.com/flyingrobots/wesley/issues/436
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:33:57Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `ci`, `tests`, `work:integrity`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

## Work Type
`integrity`

## Hill Supported
A maintainer finds op-schema drift immediately instead of discovering it later through partial runtime validation failures.

## Sponsor Actor
- Maintainer evolving the ops schema twins
- CI guarding schema contract honesty

## Playback
A schema twin drift is introduced between `op.schema.mjs` and `schemas/op.schema.json`, and CI fails fast with a message that names the canonical source of truth and how to run the same check locally.

## Problem
Wesley still carries both the ESM runtime schema and the JSON schema artifact for ops, but there is no dedicated drift check tying them together. That leaves room for the two copies to diverge quietly.

## Proposed Change
- add a CI and local check that normalizes `op.schema.mjs` and diffs it against `schemas/op.schema.json`
- document how to run the same check locally
- make the failure message point at the canonical source of truth

## Invariants
- schema twin drift fails fast
- local and CI checks use the same contract
- failure output is explicit about the source of truth

## Non-Goals
- redesigning the ops schema itself
- removing the twin artifacts in the same slice
- adding drift checks for unrelated schema families without intent

## Acceptance / Tests
- drift is detected automatically in CI
- local dev has a documented way to run the same check
- the failure message points at the canonical source of truth
