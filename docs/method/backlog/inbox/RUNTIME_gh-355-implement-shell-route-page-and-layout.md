# GH-355 Implement shell route/page and layout

- Imported from: GitHub issue
- Issue: #355
- URL: https://github.com/flyingrobots/wesley/issues/355
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:46:19Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

## Summary

Set up the Playground webpage with a terminal emulator that handles commands and displays Wesley output, running the browser-hosted Wesley, simulating the UX of running Wesley's CLI.

## User Story

|  |  |
|--|--|
| **As a** | Playground user |
| **I want** | A terminal-style UX that feels like using a real terminal emulator |
| **So that** | It feels just like using Wesley "at home" |

## Acceptance Critiera

- [ ] Playground webpage exists
- [ ] Terminal-emulator UX allows users to type commands, see output
- [ ] Wesley CLI is simulated for the browser
- [ ] Easy "Wesley-ify" button that runs the demo command
- [ ] Unrecognized commands result in a help message explaining that this is a demo, they should type the correct command

## In-Scope

- [ ] Stand up the Playground webpage
- [ ] Simulate the Wesley CLI

## Out-of-Scope

- Actually hooking this up to the browser hosted-Wesley

This task is just about standing up the webpage with the terminal emulator UX
