# GH-444 schema(qir): replace the root self-reference with a named $defs QueryPlan

- Imported from: GitHub issue
- Issue: #444
- URL: https://github.com/flyingrobots/wesley/issues/444
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:26:35Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `chore`, `work:integrity`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

## Work Type
`integrity`

## Hill Supported
Schema consumers can validate and traverse QIR schema definitions predictably without relying on root self-reference quirks.

## Sponsor Actor
- Maintainer or tool author consuming `schemas/qir.schema.json`
- CI pipeline validating QIR schema artifacts

## Playback
A schema consumer resolves the QIR schema through a named `$defs.QueryPlan` entry instead of the root self-reference, and existing validation still passes.

## Problem
`schemas/qir.schema.json` still uses a root self-reference pattern that external tooling handles inconsistently. That makes the schema harder to consume predictably.

## Proposed Change
- replace `QueryPlan: { "$ref": "#" }` with a named `$defs.QueryPlan` reference
- keep existing consumers validating successfully
- cover the change with tests or fixture validation

## Invariants
- QIR schema remains semantically equivalent for supported consumers
- external tooling gets a more predictable definition shape
- validation stays deterministic

## Non-Goals
- redesigning the QIR schema family
- changing QIR semantics beyond the definition reference shape
- introducing unrelated schema draft changes in the same slice

## Acceptance / Tests
- root self-reference is replaced with a named definition
- existing consumers still validate successfully
- schema change is covered by tests or fixture validation
