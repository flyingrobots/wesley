# EVIDENCE package coverage floor for underserved Wesley packages

Legacy `TASKS.md` still carried explicit coverage gaps for:

- `@wesley/generator-js`
- `@wesley/host-bun`
- deeper `@wesley/host-browser` behavior beyond the tiny smoke surface

`@wesley/scaffold-multitenant` is intentionally excluded from this active
coverage-debt card. Product scaffolding is extraction debt, not generic Wesley
release progress.

Done when:

- each named package has a visible minimum regression suite
- host-browser coverage extends beyond the current shallow path
- repo truth can point to package-level coverage intent without relying on a root TODO
