# Pre-push sanity shells through string commands

- Lane: `bad-code`
- Legend: `RUNTIME`

## Why now

`scripts/pre-push-sanity.mjs` builds command strings and executes them through
`/bin/bash -lc`. The current command inputs are narrow and package names are
quoted, but this execution style keeps a preventable injection class open for
future checks that may include file paths or user-controlled values.

## Hill

Pre-push sanity selects the same checks while executing every check through
argv arrays, not shell-interpreted strings.

## Done looks like

- `buildCommands` returns `{ key, label, cmd, args }`
- `runCommand` calls `spawnSync(cmd, args, { shell: false })`
- dry-run output uses a safe formatter for display only
- `shellQuote` is no longer needed for command construction
- tests cover package checks, repo checks, and explicit `--files` input

## Repo Evidence

- `scripts/pre-push-sanity.mjs`
- `.githooks/pre-push`
