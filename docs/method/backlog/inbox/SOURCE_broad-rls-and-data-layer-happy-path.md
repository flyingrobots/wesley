# Broad RLS And Data-Layer Happy Path

- Lane: `inbox`
- Legend: `SOURCE`

## Why now

The old README front door presented a broad happy path around RLS policies,
generated data-layer artifacts, and schema-driven safety. The current directive
truth table is more constrained:

- only a smaller directive subset is truly current on the main database path
- `@wes_rls` is currently a presence marker rather than the full option matrix
- several older RLS-oriented E2E tests are explicitly skipped or pending
  rewrite

The public contract should become one exact source-level happy path, not remain
a mixture of true, partial, and historical surfaces.

## Hill

The repo can define and earn one canonical database SDL happy path, including
the exact directive and RLS semantics that the main operator flow truly
supports today and the broader shape it is still trying to reach.

## Done looks like

- one canonical SDL happy path is documented and used in primary examples
- RLS semantics are described at the level the current compiler path actually
  guarantees
- skipped or legacy tests around the happy path either get restored or are
  reflected honestly in docs
- the front-door product story no longer implies broader directive support than
  `docs/DIRECTIVES.md` can defend
- the broader calm data-layer story remains visible as a product goal

## Repo Evidence

- old `README.md` at commit `6672939`
- `docs/DIRECTIVES.md`
- `docs/guides/quick-start.md`
- `test/cli-e2e.bats`
- `test/README.md`
- `test/fixtures/README.md`
