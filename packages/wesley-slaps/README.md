# @wesley/slaps

Status: Active
![pkg-slaps](https://github.com/flyingrobots/wesley/actions/workflows/pkg-slaps.yml/badge.svg?branch=main)

Lock-aware scheduling primitives (“SLAPS”) used by Wesley to orchestrate migration waves and operational tasks.

- `LockAwareExecutor` – Applies advisory locks and sequencing around task execution.
- `TasksSlapsBridge` – Integrates with `@wesley/tasks` for runnable plans.

## Development

This library is consumed internally; public APIs may evolve.

Run the workspace tests with:

```bash
pnpm --filter @wesley/slaps test
```
