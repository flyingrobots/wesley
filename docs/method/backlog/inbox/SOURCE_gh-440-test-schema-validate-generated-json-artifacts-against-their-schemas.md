# GH-440 test(schema): validate generated JSON artifacts against their schemas

- Imported from: GitHub issue
- Issue: #440
- URL: https://github.com/flyingrobots/wesley/issues/440
- Imported on: 2026-04-04
- GitHub updated: 2026-03-24T23:53:20Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `tests`, `work:integrity`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: manual override: validating generated JSON against canonical schemas is a source-contract check.

## Original Issue

## Work Type

integrity

## Hill Supported

Supports the hill that contributors and CI can trust generated JSON artifacts because schema drift is caught immediately instead of surfacing later as runtime confusion.

## Sponsor Actor

Maintainer or contributor changing generated artifact shapes who needs CI to fail the moment artifact/schema truth diverges.

## Scope

Add integration coverage that validates generated JSON artifacts against their declared JSON schemas and wires that check into CI for representative artifact families.

## Playback Impact

A contributor changes an artifact shape, runs the relevant local checks, and sees schema drift fail immediately before merge instead of discovering it later through broken docs, commands, or consumers.

## Invariants To Preserve

- generated schemas remain the contract for generated JSON artifacts
- test coverage stays deterministic
- CI should fail on truth drift, not on incidental formatting

## Non-Goals

- redesign the artifact schemas themselves
- replace package-level unit tests with only integration tests
- validate unrelated non-generated JSON blobs

## Tasks

- [ ] Add integration coverage for every generated JSON artifact family that currently declares a schema.
- [ ] Include at least one representative success fixture per artifact type.
- [ ] Fail CI when generated artifacts drift from their schemas.
- [ ] Document or link the validation path where contributors will encounter it.
