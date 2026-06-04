# Module load report release artifact

- Lane: `bad-code`
- Legend: `EVIDENCE`

## Why now

The module loader now has disable and allowlist controls, but release runs do
not yet produce evidence that says which modules were disabled, blocked, loaded,
or exposed as capability families. The May 5 ship-readiness audit calls this out
as the main remaining module trust evidence gap.

## Hill

Release evidence includes a machine-readable module-load report, so a reviewer
can audit module trust decisions after CI or a local release run.

## Done looks like

- release workflows or release scripts emit `ModuleLoadReport` JSON
- the report includes cwd, config path, env specifiers, allowlist entries,
  disabled entries, blocked entries, import failures, imported modules, and
  capability families
- client-facing automation requires either `WESLEY_DISABLE_MODULES=1` or a
  populated `WESLEY_MODULE_ALLOWLIST`
- the report is uploaded or saved with other HOLMES/WATSON/Moriarty/BLADE
  evidence
- documentation explains how to inspect and interpret the report

## Repo Evidence

- `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs`
- `.github/workflows/wesley-holmes.yml`
- `.github/workflows/cert-shipme.yml`
- `docs/method/release-runbook.md`
- `docs/audit/2026-05-05_ship-readiness.md`
