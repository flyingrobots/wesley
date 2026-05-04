# EVIDENCE package coverage floor for underserved Wesley packages

Legacy `TASKS.md` still carried explicit coverage gaps for:

- `@wesley/generator-js`
- `@wesley/host-bun`
- `@wesley/scaffold-multitenant`
- deeper `@wesley/host-browser` behavior beyond the tiny smoke surface

Done when:
- each named package has a visible minimum regression suite
- host-browser coverage extends beyond the current shallow path
- repo truth can point to package-level coverage intent without relying on a root TODO
