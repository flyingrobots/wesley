# GH-442 test(cert): cover negative SHIPME and certificate verification paths

- Imported from: GitHub issue
- Issue: #442
- URL: https://github.com/flyingrobots/wesley/issues/442
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:26:35Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `tests`, `work:integrity`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Work Type

`integrity`

## Hill Supported

A reviewer or release owner can trust failed certificate verification results because negative paths are covered explicitly and deterministically.

## Sponsor Actor

- Reviewer validating a certificate before approval
- Release owner depending on certificate verification output

## Playback

A maintainer runs the certificate suite and sees deterministic failures for wrong key types, missing keys, and corrupt SHIPME or certificate payloads.

## Problem

The cert path has positive coverage, but important negative verification paths are still under-specified. That leaves trust gaps around failure behavior.

## Proposed Change

- add negative-path certification tests for wrong key types
- add coverage for missing keys
- add coverage for corrupt SHIPME and certificate payloads
- assert the failures explicitly and deterministically

## Invariants

- failure behavior is deterministic
- verification surfaces real trust failures clearly
- cert validation stays evidence- and contract-driven

## Non-Goals

- redesigning the certificate format
- changing signing semantics in the same slice
- broadening into unrelated cert UX work

## Acceptance / Tests

- wrong key type is covered
- missing key is covered
- corrupt SHIPME and certificate payloads are covered
- failures are deterministic and asserted explicitly
