# GH-449 test(ci): add workflow-policy regression coverage for bots and rollback metadata

- Imported from: GitHub issue
- Issue: #449
- URL: https://github.com/flyingrobots/wesley/issues/449
- Imported on: 2026-04-04
- GitHub updated: 2026-03-24T23:53:21Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `ci`, `tests`, `work:integrity`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

## Work Type

integrity

## Hill Supported

Supports the hill that maintainers can trust CI policy changes because bot behavior, rollback metadata, and lockfile guardrails fail loudly instead of drifting quietly.

## Sponsor Actor

Maintainer changing GitHub workflows, policy checks, or release automation who needs quiet CI drift to become visible before merge.

## Scope

Add workflow-policy regression coverage for bot comment updaters, rollback metadata expectations, and lockfile drift guards.

## Playback Impact

A workflow-policy change that would previously have broken comment updates, rollback metadata, or lockfile enforcement is caught locally or in CI as an intentional regression instead of leaking onto `main`.

## Invariants To Preserve

- CI policy should remain deterministic and repository-local where possible
- workflow regressions should be testable without relying on fragile external state
- policy gates should stay explicit and reviewable

## Non-Goals

- redesign all GitHub workflows
- replace existing workflow smoke coverage wholesale
- add new bot features unrelated to policy regression protection

## Tasks

- [ ] Add regression coverage for bot comment updater behavior.
- [ ] Add regression coverage for rollback metadata expectations.
- [ ] Add regression coverage for lockfile drift guards.
- [ ] Ensure failures surface in CI before merge.
