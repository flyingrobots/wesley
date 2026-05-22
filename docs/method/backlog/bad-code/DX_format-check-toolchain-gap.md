# Format Check Toolchain Gap

- Lane: `bad-code`
- Legend: `DX`

## Why now

`package.json` exposes `pnpm run format` and `pnpm run format:check`, but the
workspace does not currently install a `prettier` binary. During the
`js-table-vs-rust-table.v0` parity sentinel slice, `pnpm run format:check`
failed before inspecting files:

```text
sh: prettier: command not found
```

That makes the formatting gate look available when it is not actually
re-runnable from a clean local checkout.

## Hill

The repository either installs and pins the formatter needed by the existing
format scripts or removes/renames the scripts so local validation does not
advertise a dead command.

## Done looks like

- `pnpm run format:check` runs from a clean checkout without relying on a
  globally installed formatter.
- The formatter version is pinned in workspace-managed package metadata.
- `pnpm run validate` no longer fails solely because the formatter binary is
  unavailable.
- The chosen formatter behavior is documented in `scripts/README.md` or the
  contributor-facing docs if it remains a supported gate.

## Repo Evidence

- `package.json`
- `scripts/README.md`
