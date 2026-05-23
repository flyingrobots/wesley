# GH-437 test(ci): vendor Bats support plugins into test/vendor

- Imported from: GitHub issue
- Issue: #437
- URL: https://github.com/flyingrobots/wesley/issues/437
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:33:57Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `ci`, `tests`, `work:integrity`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

## Work Type

`integrity`

## Hill Supported

CI and local Bats runs do not depend on cloning transient upstream helper repositories during the test run.

## Sponsor Actor

- Maintainer depending on deterministic CI
- Contributor running Bats suites locally without network surprises

## Playback

A maintainer runs the Bats suites and CI uses locally vendored helper plugins instead of fetching `bats-support`, `bats-assert`, and `bats-file` from GitHub during setup.

## Problem

Wesley still installs Bats helper plugins by downloading pinned upstream repos into the working tree at runtime. That is better than floating versions, but it still leaves CI and local setup dependent on network fetches.

## Proposed Change

- vendor the Bats helper plugins into the repo in a stable local path
- update CI and local docs to use the vendored path
- keep the affected Bats suites green with the vendored layout

## Invariants

- Bats helper resolution is local and deterministic
- CI does not depend on transient upstream clone availability for this path
- local docs reflect the actual plugin setup workflow

## Non-Goals

- redesigning the whole Bats test harness
- changing unrelated CI policy in the same slice
- silently changing plugin versions without recording the source

## Acceptance / Tests

- CI no longer clones Bats helper repos at runtime
- local test docs reference the vendored path
- the affected Bats suites still pass
