# TRANSMUTE generator-echo lint hook blocker

The repo-wide commit hook currently fails ESLint in `@wesley/generator-echo`
even when the active slice does not touch that package.

Observed blockers:

- `packages/wesley-generator-echo/src/emitRewriteApi.mjs`
- `packages/wesley-generator-echo/src/index.mjs`

Done when:

- `pnpm lint -- packages/wesley-generator-echo/src/emitRewriteApi.mjs packages/wesley-generator-echo/src/index.mjs` passes, or the hook is narrowed to changed files intentionally
- the fix is landed in a generator-echo cleanup slice rather than bundled into unrelated extraction work
