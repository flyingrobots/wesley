---
title: "Observer Spec And Plan"
---

## Sponsors

- Human: I can author the get side of an optic in application code without
  inventing handwritten Echo APIs or unsafe host callbacks.
- Agent: I can explain how observer-facing app declarations become lawful
  substrate plans, state codecs, and reading families without collapsing
  observer spec, observer instance, and emitted reading into one blob.

## Hill

Wesley grows an explicit `ObserverSpec -> ObserverPlan` compiler boundary so
applications can author lawful observers while Echo stays a generic runtime
that hosts observer instances over sliced holographic truth.

## Scope Hard Condition

This packet only counts as useful if a maintainer can answer all of the
following without folklore:

- what an application is allowed to author as an observer
- what part of an observer is static and compile-time validated
- what part of an observer is runtime instance state
- what Wesley emits for observer plans, observer state codecs, and readings
- why GraphQL queries are not automatically the same thing as full observers

## Why This Exists

The current stack now has a clearer optic boundary:

- GraphQL is the app-facing authoring surface for the optic's set side
- Echo remains a generic runtime substrate
- applications submit intents and later observe resulting causal truth
- readings should come from holograms and slicing rather than whole-worldline
  materialization

That still leaves an important missing seam.

The get side of the optic is not just a query shape. In OG-I terms, the
structural observer is:

```text
S = (O, B, M, K, E)
```

meaning:

- projection / aperture
- basis
- observer state space
- accumulation or update law
- emission law

Applications therefore need a lawful way to define observers in app code that
Wesley can validate and compile, while Echo remains free to host those
observers generically.

## Core Split

Wesley should preserve three different layers.

### 1. ObserverSpec

App-authored and mostly static.

This is the author's declaration of:

- what the observer may see
- what basis it uses
- what state shape it retains
- how new sliced inputs update that state
- how the reading is emitted
- what budgets and rights apply

### 2. ObserverPlan

Compiler-produced and engine-consumable.

This is the lawful compiled surface that names:

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

Wesley should treat the following as mostly static and compile-time validated:

- aperture declaration
- basis declaration
- observer state schema
- update law
- emission law
- slice budget
- rights or exposure tier

Wesley should treat the following as runtime:

- current observer state value
- current frontier, coordinate, or hologram reference
- current slice input
- emitted reading

The important special case is a memoryless observer:

- `M` is trivial
- `K` does very little or is identity-like
- `E` emits directly from the current slice

That is still an observer. It is just the degenerate case, not the general one.

## What Wesley Should Compile

For an admitted observer family, Wesley should compile:

1. one app-authored `ObserverSpec`
2. one deterministic `ObserverPlan`
3. one observer-state schema and codec family
4. one reading/result schema and codec family
5. one receipt or hologram-adjacent envelope family when needed

The main outputs should be:

- language-facing observer plan types
- state codecs
- reading codecs
- operation registries or builder helpers
- manifest traceability tying those outputs back to the authored observer spec

## What Wesley Must Not Compile

Wesley must not normalize unsafe observer authoring patterns into legitimacy.

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
App code
  ObserverSpec
    -> Wesley compile
        -> ObserverPlan
        -> ObserverState codecs
        -> Reading codecs
        -> Hologram / frontier / receipt helpers
```

That does not require every field to be authored in GraphQL itself.

The current best reading is:

- GraphQL is a good front door for app nouns, mutation shapes, and
  reading/result families
- observer specs may need an app-code DSL or builder surface for the full
  `(O, B, M, K, E)` shape

## Initial ObserverSpec Shape

Wesley's first serious observer lane should assume at least these fields:

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

Wesley should therefore treat rights and exposure as part of the compiled
observer plan rather than as an afterthought.

## Relationship To Echo

Echo should not know app-specific observer names as handwritten runtime APIs.

Echo should host generic compiled observer plans by providing substrate-level
operations such as:

- register observer
- advance observer
- read once over a hologram or frontier
- return reading envelopes

Wesley's job is to make the authored observer legal and portable enough that
Echo can host it generically.

## Immediate Next Step

The next implementation lane should be:

1. define one lawful `ObserverSpec` authoring surface
2. compile it into one explicit `ObserverPlan`
3. emit state and reading codecs
4. prove one app-owned memoryless observer and one accumulative observer
   against that surface

The first concrete proving target should be a canonical-head `worldlineSnapshot`
observer for `jedit`.
