# GH-356 Add session state store and event bus types

- Imported from: GitHub issue
- Issue: #356
- URL: https://github.com/flyingrobots/wesley/issues/356
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:46:20Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

## Summary

Set up some kind of local storage-based state system to store demo state for the Playground. Look into setting up an event bus for this page for a dynamic, reactive UX.

## User Story

|  |  |
|--|--|
| **As a** | Playground user |
| **I want** | My browser to remember stuff and be able to handle events from Postgres |
| **So that** | I can tell if we're connected to Postgres and my browser will remember my settings if I come back later |

## Acceptance Critiera

- [ ] Event bus exists
- [ ] Ability to send events to the bus and see the bus handle them (debug print OK)
- [ ] Ability to store persisted data between page loads locally in-browser (debug print OK)

## In-Scope

- [ ] Sending events
- [ ] Subscribing to events
- [ ] Write local data
- [ ] Read local data

## Out-of-Scope

- Hooking this up to anything in particular
- Routing Postgres events
