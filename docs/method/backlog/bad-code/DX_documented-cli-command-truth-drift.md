# Documented CLI command truth drift

- Lane: `bad-code`
- Legend: `DX`

## Why now

The guide documents `pnpm wesley holmes dashboard`, but the root Wesley CLI does
not currently register a matching command. That makes the docs look more
complete than the executable surface and creates avoidable release/operator
confusion.

## Hill

Documented local CLI commands are executable, or the docs clearly label them as
workflow artifacts, future work, or package-specific commands.

## Done looks like

- `docs/GUIDE.md` no longer points to a non-existent `pnpm wesley holmes dashboard`
  path
- either a real local dashboard command exists or the guide documents the actual
  static artifact/local report workflow
- a docs-truth check catches future drift for backticked `pnpm wesley ...`
  command examples in README and GUIDE

## Repo Evidence

- `docs/GUIDE.md`
- `packages/wesley-cli/src/program.mjs`
- `.github/workflows/wesley-holmes.yml`
- `docs/holmes-dashboard`
