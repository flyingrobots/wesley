# GH-450 feat(runtime): support additional durable ledger backends beyond git-warp

- Imported from: GitHub issue
- Issue: #450
- URL: https://github.com/flyingrobots/wesley/issues/450
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:19:45Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Source: ROADMAP_2.md backlog

Track the post-GA roadmap item for additional durable backends such as SQLite or Postgres.

Done when:
- a second durable backend is implemented behind `EventStorePort`
- parity/replay semantics match the git-warp baseline
- operational tradeoffs are documented
