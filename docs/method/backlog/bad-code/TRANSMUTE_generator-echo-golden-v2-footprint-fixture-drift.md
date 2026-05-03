# TRANSMUTE generator-echo golden v2 footprint fixture drift

While validating the Echo lint-hook blocker cleanup, the full
`@wesley/generator-echo` suite failed in `test/golden-v2.test.mjs`.

Observed mismatch:

- generated Echo IR includes `footprint: null` on operations without footprint
  directives
- `test/fixtures/basic-v2.ir.json` and `test/fixtures/joins-v2.ir.json` omit
  those fields

Done when:

- the golden v2 fixtures intentionally match the current Echo IR shape, or the
  generator intentionally omits null footprints before golden comparison
- `pnpm --filter @wesley/generator-echo test` passes
