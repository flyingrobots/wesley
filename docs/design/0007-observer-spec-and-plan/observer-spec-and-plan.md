---
title: 'Continuum Observer Spec And Plan'
---

## Sponsors

- Human: I can author the get side of an optic in application code without
  inventing handwritten Echo APIs or unsafe host callbacks.
- Agent: I can explain how Continuum observer declarations become lawful
  module-produced plans, state codecs, and reading families without collapsing
  observer spec, observer instance, and emitted reading into one blob.

## Hill

The Continuum module grows an explicit `ObserverSpec -> ObserverPlan` compiler
boundary so applications can author lawful observers while Echo stays a generic
runtime that hosts observer instances over sliced holographic truth.

## Scope Hard Condition

This packet only counts as useful if a maintainer can answer all of the
following without folklore:

- what an application is allowed to author as an observer
- what part of an observer is static and compile-time validated
- what part of an observer is runtime instance state
- what the Continuum module emits for observer plans, observer state codecs,
  and readings
- why GraphQL queries are not automatically the same thing as full observers

## Why This Exists

The current stack now has a clearer optic boundary:

- GraphQL is the authored contract surface for both set-side and get-side
  families
- Echo remains a generic runtime substrate
- applications submit intents and later observe resulting causal truth
- readings should come from holograms and slicing rather than whole-worldline
  materialization

That still leaves an important missing seam.

Observer-anything is Continuum-only. Generic Wesley and non-Continuum modules
do not need observer nouns. Continuum does.

In OG-I terms, the structural observer is:

```text
S = (O, B, M, K, E)
```

meaning:

- projection / aperture
- basis
- observer state space
- accumulation or update law
- emission law

Applications therefore need a lawful way to define observers in GraphQL that
the Continuum module can validate and compile, while Echo remains free to host
runtime behavior built from those compiled artifacts.

## Core Split

The Continuum observer lane should preserve three different layers.

### 1. ObserverSpec

GraphQL-authored and mostly static.

This is the author's declaration of:

- what the observer may see
- what basis it uses
- what state shape it retains
- how new sliced inputs update that state
- how the reading is emitted
- what budgets and rights apply

### 2. ObserverPlan

The GraphQL-authored family for the normalized, engine-consumable plan shape.

Wesley compiles artifacts for this family, and Continuum tools/runtimes later
materialize actual plan values conforming to it.

It names:

- validated aperture and slicing constraints
- basis identifiers or compiled basis references
- state schema identity and codecs
- update and emission plans
- reading/result codecs
- rights and exposure constraints

### 3. ObserverInstance

Runtime and stateful.

This is the hosted object inside Echo carrying:

- current observer state
- current frontier or hologram reference
- the latest emitted reading or reading cursor as needed

These layers must remain distinct. Collapsing them is how an optic-shaped
runtime turns into a mushy RPC layer.

## Static Versus Dynamic

The Continuum module should treat the following as mostly static and
compile-time validated:

- aperture declaration
- basis declaration
- observer state schema
- update law
- emission law
- slice budget
- rights or exposure tier

The runtime should treat the following as dynamic:

- current observer state value
- current frontier, coordinate, or hologram reference
- current slice input
- emitted reading

The important special case is a memoryless observer:

- `M` is trivial
- `K` does very little or is identity-like
- `E` emits directly from the current slice

That is still an observer. It is just the degenerate case, not the general one.

## What The Continuum Module Should Compile

For an admitted observer family, the Continuum module should compile:

1. one app-authored `ObserverSpec`
2. one deterministic `ObserverPlan`
3. one observer-state codec family
4. one reading/result family
5. one receipt or hologram-adjacent envelope family when needed

The main outputs should be:

- language-facing observer plan types
- state codecs
- reading codecs
- operation registries or builder helpers
- manifest traceability tying those outputs back to the authored observer spec

## What The Continuum Module Must Not Compile

The Continuum module must not normalize unsafe observer authoring patterns into
legitimacy.

In particular:

- no arbitrary JavaScript closures as observer law
- no arbitrary Rust callbacks as observer law
- no hidden full-state materialization disguised as a cheap observer
- no undeclared traversal beyond the compiled aperture and slice budget

The right rule is the same as on the rewrite side:

> authored observer behavior must enter the runtime only through a bounded,
> validated, compiler-produced surface.

## Proposed Compiler Surface

The likely authored and compiled layers should look roughly like this:

```text
GraphQL contract families
  ObserverSpec
  ObserverPlan
  ReadingEnvelope
    -> Continuum module compile
        -> ObserverState codecs
        -> Reading codecs and generated artifacts
        -> Hologram / frontier / receipt helpers
```

GraphQL is the authored language. Module-specific behavior enters through
directives rather than through a parallel authoring DSL.

## Initial ObserverSpec Shape

The first serious Continuum observer lane should assume at least these fields:

- `aperture`
- `basis`
- `stateSchema`
- `updatePlan`
- `emitPlan`
- `budgets`
- `rights`

That is enough to express:

- stateless readers
- accumulative readers
- narrow canonical-head reads
- richer provenance-aware or conflict-aware readers later

## Rights And Exposure

Observer legality is not just a performance question.

The observer boundary now also needs governance-aware constraints such as:

- revelation tier
- exposure tier
- redaction policy
- retention constraints
- whether a reading may surface witness-only, receipt-only, or full
  provenance-bearing detail

The Continuum module should therefore treat rights and exposure as part of the
compiled observer plan rather than as an afterthought.

## Relationship To Wesley And Echo

Generic Wesley should not expose observer nouns as part of its base module
contract.

The correct layering is:

- Wesley base platform provides generic compiler and toolchain machinery
- the Continuum module owns observer authoring and lowering
- Echo hosts compiled observer plans generically

Echo should not know app-specific observer names as handwritten runtime APIs.

Echo should host generic compiled observer plans by providing substrate-level
operations such as:

- register observer
- advance observer
- read once over a hologram or frontier
- return reading envelopes

The Continuum module's job is to make the authored observer legal and portable
enough that Echo can host it generically.

## Immediate Next Step

The next implementation lane should be:

1. keep observer-anything out of generic Wesley
2. relocate the observer compile surface into the Continuum module
3. define one lawful `ObserverSpec` authoring surface
4. compile it into one explicit `ObserverPlan`
5. emit state and reading codecs
6. prove one app-owned memoryless observer and one accumulative observer
   against that surface

The first concrete proving target should be a canonical-head `worldlineSnapshot`
observer for `jedit`.
