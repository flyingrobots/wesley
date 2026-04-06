# Boring Database Operator Surface

- Lane: `inbox`
- Legend: `RUNTIME`

## Why now

The old README told a clean operator story:

`generate -> plan -> rehearse -> certify -> deploy`

The current CLI surface is different:

- `cert-create`
- `cert-verify`
- `cert-badge`
- `blade`

There is no public `wesley deploy` command, and there is no single boring
operator path that cleanly replaces the old public story. The old story should
survive as a target, not as a silent casualty of the signpost refresh.

## Hill

Wesley exposes one honest, boring operator flow for the current
database-change lane and can eventually present the full
`generate -> plan -> rehearse -> certify -> deploy` story without hand-waving.

## Done looks like

- the repo chooses one public operator story and uses it consistently
- either `certify` / `deploy` return as real commands, or the public docs adopt
  a different operator story so consistently that the old one can be retired on
  purpose
- quick-start docs, case studies, and command help agree on the same operator
  path
- the chosen path has one minimal witness or demo that proves it still works

## Repo Evidence

- old `README.md` at commit `6672939`
- current `pnpm wesley --help`
- `docs/guides/quick-start.md`
- `docs/blade.md`
- `packages/wesley-cli/src/commands/`
