# GH-268 CLI: friendly Node version check at startup

- Imported from: GitHub issue
- Issue: #268
- URL: https://github.com/flyingrobots/wesley/issues/268
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:52Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`, `pkg:wesley-host-node`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Add a friendly Node version guard to the CLI entrypoint to improve error messaging on older runtimes.

What

- At the top of `packages/wesley-host-node/bin/wesley.mjs`, check process.version and print a clear message if < 18.17, then exit(1).
- Keep engines in package.json, but don’t rely solely on npm’s warning.

Acceptance

- Running `wesley` on Node < 18.17 shows a crisp actionable message.
