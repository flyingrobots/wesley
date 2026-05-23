# GH-456 schema(json): unify IR/evidence schema drafts across the spec family

- Imported from: GitHub issue
- Issue: #456
- URL: https://github.com/flyingrobots/wesley/issues/456
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:33:57Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `chore`, `work:integrity`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: manual override: schema-draft unification is a source/schema contract problem even when the family includes evidence schemas.

## Original Issue

## Work Type

`integrity`

## Hill Supported

Schema consumers and validators can reason about the IR/evidence schema family without draft-mismatch caveats or unsafe cross-draft assumptions.

## Sponsor Actor

- Maintainer evolving the schema family
- Tooling or CI consumer validating Wesley JSON artifacts

## Playback

A maintainer can point to one explicit schema-draft strategy for the IR/evidence family, and validation tooling exercises that strategy instead of relying on caveats buried in spec docs.

## Problem

The IR family still mixes draft 2020-12 and draft-07 JSON Schema documents. The split is documented, but it still creates tooling friction and weakens the contract unless the compatibility boundary is explicit and tested.

## Proposed Change

- choose one supported schema-draft strategy or an explicit compatibility boundary
- align the schema family and validation tooling to that strategy
- protect the chosen boundary with validation and fixture coverage

## Invariants

- schema validation remains deterministic
- cross-schema references are either safe or explicitly disallowed/documented
- docs and tooling agree on the supported draft story

## Non-Goals

- redesigning the entire schema family in one slice
- changing artifact semantics unrelated to schema-draft compatibility
- silently relying on tool-specific behavior without documentation

## Acceptance / Tests

- supported schema-draft strategy is explicit
- cross-references between schema groups are safe or explicitly documented
- validation/tooling coverage protects the chosen draft boundary
