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
operator path that cleanly replaces the old public story.

## Hill

Wesley exposes one honest, boring operator flow for the current
database-change lane, and the front-door docs no longer imply commands or
stages that are not actually public.

## Done looks like

- the repo chooses one public operator story and uses it consistently
- either `certify` / `deploy` return as real commands, or the docs fully adopt
  the current `cert-create` / `cert-verify` / `blade` shape
- quick-start docs, case studies, and command help agree on the same operator
  path
- the chosen path has one minimal witness or demo that proves it still works

## Repo Evidence

- old `README.md` at commit `6672939`
- current `pnpm wesley --help`
- `docs/guides/quick-start.md`
- `docs/blade.md`
- `packages/wesley-cli/src/commands/`
