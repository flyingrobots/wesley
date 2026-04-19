<!-- docs-truth: status=current owner=@flyingrobots -->

# Wesley WARP Drift

This note captures where Wesley currently drifts from the stronger WARP
doctrine now shared across `blog`, `continuum`, `echo`, `warp-ttd`, and app
repos such as `jedit`.

It is not a claim that Wesley is pointed the wrong way. Wesley is already
carrying several of the right ideas. The drift is mostly a boundary drift:
what the repo says the compiler should eventually own versus what the active
Continuum lane actually compiles and publishes today.

## The current WARP baseline

The relevant baseline is now:

- there is no canonical materialized graph-in-itself; shared runtime truth is
  witnessed causal history and observer-relative readings over that history
- the same admission kernel recurs across tick admission, braid comparison,
  and distributed suffix import, differing mainly by normalization path
- applications should compile the set side into lawful intent carriers and the
  get side into lawful observer plans rather than hand-wire substrate APIs
- the shared runtime boundary now needs explicit family nouns for:
  `IntentEnvelope`, `TickResult`, `ObserverPlan`, `ObservationRequest`,
  `ReadingEnvelope`, `SuffixShell`, and `ImportOutcome`
- Continuum, not Wesley, is the coordination spine that owns shared cross-repo
  contract truth

## Where Wesley is already strong

Wesley is not behind in the generic compiler story.

The repo already has meaningful truth in the places that matter:

- GraphQL SDL is treated as authored source rather than generated fallout
- authored source, lowered IR, realization shell, and witness output are kept
  distinct
- `@wesley/continuum` already owns real scope profiles, contract bundle
  definitions, and sync projections
- Wesley already carries a real observer design packet and a first
  `observer-plan` command
- release and sync are already understood as publication-boundary work rather
  than ad hoc file copying

That means the current problem is not that Wesley lacks doctrine. The problem is
that the active compile lane is narrower than the doctrine it now claims.

## Where Wesley is drifting

### 1. The Continuum lane is still pinned to receipt and settlement families

The active Continuum compiler path still assumes:

- `receipt-family`
- `settlement-family`

as the primary shared families.

That made sense for the earlier proving lane. It is now too narrow. Continuum
has frozen a minimum runtime-boundary family, but Wesley does not yet treat that
family as a first-class compile, release, sync, or witness seam.

If that remains true, neighboring repos will keep guessing about the runtime
boundary and Wesley will keep proving the wrong altitude first.

### 2. The observer compiler boundary is still only half-realized

Wesley now has the right packet and the right CLI noun:

- app-authored `ObserverSpec`
- compiler-produced `ObserverPlan`

But the current shipped output is still only a generated TypeScript plan
constant. The compiler does not yet emit the fuller boundary the stack is now
asking for:

- observer-state codecs
- reading/result codecs
- runtime-boundary family alignment with `ObservationRequest` and
  `ReadingEnvelope`

That is not failure. It is unfinished work that must not be mistaken for a full
observer lane.

### 3. The contract bundle story still teaches the older compile targets

Today the practical lane is still described mostly as:

- `compile-ttd`
- `bundle-echo`
- `contract release --family receipt-family`

That means the bundle and sync story still leans on target-specific leg names
instead of the newer shared runtime-boundary carriers the stack actually needs.

The drift is subtle but real:

- Wesley is still teaching target legs first
- the stack now needs shared envelopes first, then target projections

### 4. Wesley risks becoming a shadow authored home for Continuum families

Wesley currently carries local Continuum family SDL files for the proving lane.
That was useful bootstrap.

The newer posture is stricter:

- Continuum owns coordination truth
- Wesley should consume the shared family through an explicit authored home or
  released bundle
- Wesley should not answer every new shared family by creating another locally
  sovereign shadow schema

The next shared family, especially `runtime-boundary-family`, should not become
"just another Wesley-local schema" by inertia.

## What Wesley should look like next

The correction path is straightforward.

### First: treat the runtime-boundary family as the next shared Continuum seam

Wesley should grow a first-class Continuum lane for:

- `IntentEnvelope`
- `TickResult`
- `ObserverPlan`
- `ObservationRequest`
- `ReadingEnvelope`
- `SuffixShell`
- `ImportOutcome`

That means:

- `@wesley/continuum` grows one `runtime-boundary-family` scope
- contract release/sync understand that family explicitly
- docs stop implying that `receipt-family` is the whole active Continuum lane

### Second: finish the observer compiler boundary honestly

The observer lane should move from:

- generated TypeScript plan constant

to:

- compiled plan artifact
- observer-state codec family
- reading/result codec family
- explicit alignment with the shared runtime-boundary family

Wesley should still not own runtime observer instance state. It should own the
static compiled legality boundary.

### Third: compile shared envelopes first, then target projections

For the next lane, the important question should be:

- what shared family is being compiled?

and only then:

- what `warp-ttd`, `echo`, or app-facing projections are emitted from it?

That keeps Wesley aligned with Continuum’s ownership model instead of quietly
sliding back into target-first folklore.

## Immediate backlog

The next concrete item is:

- [SOURCE_continuum-runtime-boundary-family-compiler-lane](./method/backlog/asap/SOURCE_continuum-runtime-boundary-family-compiler-lane.md)

Related existing context:

- [0007 — Observer spec and plan](./design/0007-observer-spec-and-plan/observer-spec-and-plan.md)
- [Wesley role in Continuum](./architecture/continuum-wesley-role.md)
- [SOURCE_observer-spec-and-plan-lowering](./method/backlog/up-next/SOURCE_observer-spec-and-plan-lowering.md)
- [SOURCE_continuum-lane-identity-family-boundary](./method/backlog/up-next/SOURCE_continuum-lane-identity-family-boundary.md)

## Practical rule

Wesley should stay the contract compiler and publication-boundary manager.

What must change is the exact seam it treats as "current Continuum truth":

- not just receipt and settlement families
- not target-specific projections as the primary noun
- not a lonely observer-plan sidecar pretending to finish the read boundary

The next honest Wesley cut is:

- compile the shared runtime-boundary family
- finish the observer compiler lane against that family
- let targets consume generated projections of that family rather than invent
  the seam by hand
