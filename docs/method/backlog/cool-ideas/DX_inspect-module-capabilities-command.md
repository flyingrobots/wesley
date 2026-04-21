# Inspect module capabilities command

- Lane: `cool-ideas`
- Legend: `DX`

## Why now

If modules are the real architecture, there should be a first-class way to ask:

- what modules are loaded
- what each module contributes
- which targets/checks/gates/scenarios are currently available

Right now that knowledge is still too implicit. A maintainer often has to read
config, browse files, or mentally model the loader instead of inspecting one
explicit surface.

## Hill

A maintainer can run one local command and get a compact, trustworthy map of
loaded modules and their registered capabilities.

## Done looks like

- one command such as `wesley inspect-module` or `wesley modules list` exists
- the output shows module identity plus capability families, not just package
  names
- the surface is useful in both human-readable and machine-readable forms
- the command is valuable for debugging missing targets and missing BLADE or
  Holmes/Watson/Moriarty behaviors

## Repo Evidence

- `docs/design/wesley-module-capability-contract.md`
- `packages/wesley-cli/src/framework/module-loader.mjs`

