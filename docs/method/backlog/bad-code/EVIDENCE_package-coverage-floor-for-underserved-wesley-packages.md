# EVIDENCE package coverage floor for underserved Wesley packages

Legacy `TASKS.md` still carried explicit coverage gaps for host packages:

- `@wesley/host-bun`
- deeper `@wesley/host-browser` behavior beyond the tiny smoke surface

The deleted product-scaffolding and generic JavaScript generator packages are
intentionally excluded from this active coverage-debt card. Deleted packages are
not release-progress coverage targets.

Done when:

- each named host package has a visible minimum regression suite
- host-browser coverage extends beyond the current shallow path
- repo truth can point to package-level coverage intent without relying on a root TODO
