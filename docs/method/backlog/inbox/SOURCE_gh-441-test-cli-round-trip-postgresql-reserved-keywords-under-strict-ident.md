# GH-441 test(cli): round-trip PostgreSQL reserved keywords under --strict-ident

- Imported from: GitHub issue
- Issue: #441
- URL: https://github.com/flyingrobots/wesley/issues/441
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:33:57Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `tests`, `work:integrity`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

## Work Type
`integrity`

## Hill Supported
A maintainer can trust `--strict-ident` behavior against PostgreSQL reserved words because the full reserved set is covered explicitly in CI.

## Sponsor Actor
- Maintainer evolving QIR/ops identifier handling
- Contributor debugging strict identifier failures

## Playback
A maintainer runs the strict-identifier suite and sees deterministic coverage of the PostgreSQL reserved keyword set, with failures naming the offending keyword clearly.

## Problem
Wesley has shared identifier logic now, but it still lacks a full integration test that round-trips the PostgreSQL reserved keyword set under `--strict-ident`. That leaves a regression hole around one of the most failure-prone edges in QIR/ops emission.

## Proposed Change
- add an integration test for the PostgreSQL 16 reserved keyword set under `--strict-ident`
- make failures identify the offending keyword clearly
- run the coverage in CI

## Invariants
- strict identifier behavior stays deterministic
- failures stay explainable instead of mysterious SQL breakage
- the test protects the shared keyword policy instead of private implementation details

## Non-Goals
- redesigning identifier policy in the same slice
- broadening into non-PostgreSQL dialect behavior
- weakening strict mode to avoid fixing regressions

## Acceptance / Tests
- the test suite covers the full reserved list
- failures clearly identify the offending keyword
- the test runs in CI
