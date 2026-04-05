# GH-447 tooling(gh): add a deterministic PR review-thread helper for gh

- Imported from: GitHub issue
- Issue: #447
- URL: https://github.com/flyingrobots/wesley/issues/447
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:26:35Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `chore`, `work:integrity`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

## Work Type
`integrity`

## Hill Supported
Maintainers can reply to and resolve GitHub PR review threads deterministically from a supported helper instead of hand-building fragile GraphQL payloads.

## Sponsor Actor
- Maintainer doing PR hygiene and review follow-up

## Playback
A maintainer runs one documented helper to reply to a review thread and resolve it, without custom shell quoting or ad hoc GraphQL JSON.

## Problem
Routine PR thread follow-up still depends on fragile one-off shell commands and hand-built GraphQL calls. That makes review hygiene easy to get wrong and hard to repeat safely.

## Proposed Change
- add a deterministic GitHub helper for PR review-thread reply and resolve flows
- document the supported invocation for maintainers
- stop relying on hand-built GraphQL payloads for normal review-thread hygiene

## Invariants
- deterministic behavior for supported reply/resolve flows
- no hidden shell quoting tricks in the common path
- documentation reflects the actual supported helper flow

## Non-Goals
- building a full GitHub automation framework
- replacing every manual review action on GitHub
- changing PR review policy itself

## Acceptance / Tests
- supported reply and resolve flows are scripted
- helper behavior is documented for maintainers
- routine review-thread interactions no longer require hand-built GraphQL payloads
- failure paths are explicit and deterministic
