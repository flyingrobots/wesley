# Format Check Toolchain Gap Closeout

- Lane: `bad-code`
- Legend: `DX`
- Status: resolved
- Closed: 2026-05-23

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

## Resolution

The repository now installs and pins the formatter used by the existing format
scripts. The `.prettierignore` policy also names the surfaces Prettier must not
own:

- Wesley SDL files (`*.graphql`) remain compiler inputs because some are valid
  SDL, some are Wesley-specific fixture dialects, and some are intentionally
  invalid diagnostic cases.
- Rust IR golden bytes (`test/fixtures/ir-parity/*.l1.json`) remain under
  generator/hash control.

## Done Evidence

- `pnpm run format:check` runs from a clean checkout without relying on a
  globally installed formatter.
- The formatter version is pinned in workspace-managed package metadata.
- `pnpm run validate` no longer fails solely because the formatter binary is
  unavailable.
- The formatter ownership boundary is documented in `scripts/README.md` and
  `docs/scripts-reference.md`.

## Repo Evidence

- `package.json`
- `.prettierignore`
- `scripts/README.md`
- `docs/scripts-reference.md`
