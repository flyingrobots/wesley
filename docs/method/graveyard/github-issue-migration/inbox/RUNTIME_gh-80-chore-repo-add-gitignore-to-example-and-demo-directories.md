# GH-80 chore(repo): add .gitignore to example and demo directories

- Imported from: GitHub issue
- Issue: #80
- URL: https://github.com/flyingrobots/wesley/issues/80
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:09Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`, `chore`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

The `example/` and `demo/` directories are a mix of source files and generated artifacts (`out/`, `.wesley/`). To keep them clean and prevent generated artifacts from being accidentally committed, a `.gitignore` file should be added to both directories to ignore these generated files.
