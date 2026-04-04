# GH-79 chore(repo): consolidate root-level test directories

- Imported from: GitHub issue
- Issue: #79
- URL: https://github.com/flyingrobots/wesley/issues/79
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:08Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`, `chore`, `tests`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

The repository currently has both a `test/` and a `tests/` directory at the root. This is confusing. This task is to standardize on the `test/` directory, move all relevant files from `tests/` into `test/`, and then remove the `tests/` directory.
