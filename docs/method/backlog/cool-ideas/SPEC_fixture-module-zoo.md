# Fixture module zoo

- Lane: `cool-ideas`
- Legend: `SPEC`

## Why now

The current fixture module is enough to prove the loader exists. It is not yet
rich enough to function as a long-lived "extension zoo" that makes the
architecture tangible.

There is value in having one intentionally fake but comprehensive module set
that demonstrates:

- compiler extensions
- evidence hooks
- judgment hooks
- BLADE scenarios
- CLI additions

without requiring any real product semantics.

## Hill

Wesley keeps one miniature module zoo that acts as a living executable example
of the full extension surface.

## Done looks like

- the zoo includes at least two or three tiny modules with different capability
  mixes
- one module is compiler-heavy, one is evidence/judgment-heavy, and one is
  BLADE-heavy
- the zoo doubles as examples, regression tests, and onboarding material
- maintainers can demonstrate the whole extension story locally without
  touching Continuum or Postgres

## Repo Evidence

- `packages/wesley-cli/test/fixtures/modules/`
- `docs/WESLEY_GLOSSARY.md`
- `docs/design/wesley-module-capability-contract.md`

