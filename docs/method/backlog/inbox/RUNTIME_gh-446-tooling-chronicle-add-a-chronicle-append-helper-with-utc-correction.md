# GH-446 tooling(chronicle): add a Chronicle append helper with UTC/correction enforcement

- Imported from: GitHub issue
- Issue: #446
- URL: https://github.com/flyingrobots/wesley/issues/446
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:26:35Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `chore`, `work:integrity`

> Superseded: Wesley retired the Chronicle as an active workflow on 2026-04-04.
> Keep this imported issue as historical context unless the archive itself
> needs maintenance.

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

## Work Type

`integrity`

## Hill Supported

Contributors and agents can append Chronicle entries correctly without hand-rolled shell snippets drifting away from the append-only rules.

## Sponsor Actor

- Contributor or agent recording work in the Chronicle
- Maintainer auditing Chronicle history later

## Playback

A contributor uses one supported helper to append a Chronicle entry with normalized UTC timestamps and append-only correction support, then the docs point to that helper instead of raw shell fragments.

## Problem

Chronicle entry creation still depends on ad hoc shell snippets. That makes timestamp formatting, correction handling, and append-only discipline too easy to get wrong.

## Proposed Change

- add a Chronicle append helper
- normalize timestamps to whole-second UTC
- support append-only correction entries
- update Chronicle instructions to point to the helper

## Invariants

- Chronicle stays append-only
- helper writes valid JSONL entries
- correction flow adds new entries instead of mutating old ones
- docs stay honest about the supported workflow

## Non-Goals

- redesigning the Chronicle format
- introducing remote logging infrastructure
- retroactively rewriting existing Chronicle history

## Acceptance / Tests

- helper writes valid Chronicle JSONL entries
- timestamps are normalized to whole-second UTC
- correction entries are supported and documented
- existing Chronicle instructions point to the helper
