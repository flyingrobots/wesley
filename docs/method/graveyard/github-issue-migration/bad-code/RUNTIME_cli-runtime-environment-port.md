# CLI runtime environment port

- Lane: `bad-code`
- Legend: `RUNTIME`

## Why now

The CLI can inject cwd/env in important paths, but production entrypoints still
default directly to `process.cwd()` and `process.env`. `WesleyCommand.execute`
also mutates `process.env.WESLEY_LOG_FORMAT` for JSON mode, which is awkward for
in-process command tests and repeated program invocations.

## Hill

CLI startup uses an explicit runtime environment object so tests and embedded
callers can run commands without leaking process state.

## Done looks like

- a `RuntimeEnvironment` or equivalent object carries cwd, env, streams, logger,
  fs, shell, importer, clock, and log-format settings
- `program()`, module discovery, and `WesleyCommand` accept the runtime
  environment while preserving default host-binary behavior
- JSON/log-format handling no longer mutates global process env
- tests prove repeated in-process command invocations do not leak env state
- module discovery still works through injected cwd/env/importer fixtures

## Repo Evidence

- `packages/wesley-cli/src/program.mjs`
- `packages/wesley-cli/src/framework/WesleyCommand.mjs`
- `packages/wesley-cli/src/framework/module-loader.mjs`
- `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs`
- `docs/audit/2026-05-05_code-quality.md`
