# Continuum Runtime Boundary Family Compiler Lane

- Lane: `asap`
- Legend: `SOURCE`
- Rank: `1`

## Why now

Continuum now has a minimum shared runtime-boundary family with seven top-level
contract nouns:

- `IntentEnvelope`
- `TickResult`
- `ObserverPlan`
- `ObservationRequest`
- `ReadingEnvelope`
- `SuffixShell`
- `ImportOutcome`

That family is now the real shared seam shaping Echo, `warp-ttd`, Wesley, and
apps such as `jedit`.

Wesley does not yet compile that seam directly. The active Continuum lane is
still centered on:

- `receipt-family`
- `settlement-family`
- target-first projections such as `compile-ttd` and `bundle-echo`

The compiler now needs to catch up to the boundary the stack actually intends
to use.

## Hill

Wesley grows one explicit compiler lane for the Continuum runtime-boundary
family and treats it as the next shared contract family rather than as a
product-local or handwritten seam.

## Done looks like

- one explicit `runtime-boundary-family` scope exists in `@wesley/continuum`
- contract release/sync can name that family directly
- the family is compiled from an explicit Continuum-authored home or release
  object, not smuggled in as another shadow-authored Wesley schema by default
- Wesley can emit the target projections needed by:
  - `warp-ttd`
  - Echo
  - app-facing generated surfaces where relevant
- docs stop implying that `receipt-family` is the whole active Continuum lane

## Observer-side hard condition

This lane must not treat `ObserverPlan` as an isolated TypeScript helper.

The runtime-boundary family should force the observer compiler lane to become
more honest about the read side:

- compiled observer plan
- observer-state codec family
- reading/result codec family
- alignment with `ObservationRequest` and `ReadingEnvelope`

The compiler still does **not** own runtime observer instance state.

## Must not do

- create another quietly sovereign Wesley-local authored home for a shared
  Continuum family by inertia
- keep teaching target-specific legs as the primary nouns while the shared
  envelope family stays implicit
- pretend the existing `observer-plan` command already closes the full read
  boundary
- blur authored family, generated projection, and runtime semantics into one
  blob

## Repo Evidence

- `packages/wesley-continuum/src/scopes.mjs`
- `packages/wesley-continuum/src/contract-bundle.mjs`
- `docs/design/0007-observer-spec-and-plan/observer-spec-and-plan.md`
- `docs/architecture/continuum-wesley-role.md`
- `schemas/continuum-receipt-family.graphql`
- Continuum `0028 — Minimum runtime boundary contract family`
