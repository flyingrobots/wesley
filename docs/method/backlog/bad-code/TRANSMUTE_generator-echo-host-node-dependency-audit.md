# TRANSMUTE generator-echo host-node dependency audit

Legacy `TASKS.md` still flagged `@wesley/generator-echo` as depending on
`@wesley/host-node` without a clear import path.

Done when:
- the dependency is either justified by real use or removed
- package metadata matches actual imports
- the result reduces accidental cross-package coupling
