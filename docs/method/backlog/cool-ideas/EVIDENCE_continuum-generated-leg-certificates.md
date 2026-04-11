# Continuum Generated-Leg Certificates

- Lane: `cool-ideas`
- Legend: `EVIDENCE`
- Rank: `2`

## Why now

The current witness output is a good bounded checklist over whole surfaces, but
it is still mostly family-level and path-level. As the Continuum lane grows,
maintainers will want smaller proof artifacts that say a specific generated leg
realizes a specific contract family at a specific schema hash.

That would let Wesley's witness lane become more composable without pretending
it already proves full runtime equivalence.

## Hill

Wesley can emit small per-leg certificates that make the current witness lane
composable and let a maintainer inspect one generated surface without reading
a whole family report.

## Done looks like

- each certificate names the authored home, family id, schema hash, generated
  leg, leg hash, authority status, and witness scope
- certificates distinguish stable consumer legs from inspect-only or mocked
  legs
- family-level witness reports can aggregate leg certificates instead of
  hard-coding every comparison forever
- failure diffs point at one leg and one authority boundary instead of vague
  "bundle drift"
- the certificate format is proven first on the current TTD-plus-Echo minimum
  surface before any broader cross-repo automation

## Repo Evidence

- `packages/wesley-cli/src/commands/witness-continuum.mjs`
- `packages/wesley-cli/test/witness-continuum.bats`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-generator-echo/src/EchoPlugin.mjs`
- `docs/invariants/evidence-truth.md`
- `docs/architecture/continuum-wesley-role.md`

## Related Carry-Over

- `#448`
- `#451`
