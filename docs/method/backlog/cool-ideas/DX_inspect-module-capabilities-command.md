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

- one command such as `wesley modules list` exists
- the output shows module identity plus capability families, not just package
  names
- the surface is useful in both human-readable and `--json` forms
- JSON output is backed by the same `ModuleLoadReport` shape used by runtime
  diagnostics and release evidence
- a stable summary groups capabilities by area and collection without exposing
  mutable live capability objects
- the command is valuable for debugging missing targets and missing BLADE or
  Holmes/Watson/Moriarty behaviors
- README and GUIDE show this command immediately after module-loading examples

## Repo Evidence

- `docs/design/wesley-module-capability-contract.md`
- `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs`
- `packages/wesley-cli/src/framework/module-loader.mjs`
- `docs/audit/2026-05-05_code-quality.md`
