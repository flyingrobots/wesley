# README release surface cleanup

- Lane: `bad-code`
- Legend: `DX`

## Why now

The May 5 documentation audit found small but public-facing README release
surface issues: the license badge URL omits the `flyingrobots/wesley` owner,
the module quick start lacks a verification/troubleshooting link, and the
`@wesley/runtime-node` package row says `0% -> Alpha` while the release branch
depends on it for shared module entry loading and trust controls.

## Hill

A reader can trust the README badges, package matrix, and quick-start module
flow without cross-checking source or package internals.

## Done looks like

- the license badge points at `flyingrobots/wesley`
- the module quick start links to module authoring/loading troubleshooting
- the `@wesley/runtime-node` package matrix row reflects its current release
  responsibility, or explains why its progress remains low
- README, GUIDE, ARCHITECTURE, CONTRIBUTING, and SECURITY use one consistent
  module-first release posture

## Repo Evidence

- `README.md`
- `docs/GUIDE.md`
- `docs/ARCHITECTURE.md`
- `docs/audit/2026-05-05_documentation-quality.md`
