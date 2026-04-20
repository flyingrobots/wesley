# Wesley Module Capability Contract
<!-- docs-truth: status=current owner=@flyingrobots -->

This note defines the next real module boundary for Wesley.

The current `WesleyModule` contract is enough to load modules and register
module-owned CLI commands. It is **not** enough to support the architecture we
actually want:

- `wesley compile` should stay in Wesley
- Continuum and Postgres should be loadable modules
- Wesley should ship no domain modules by default
- Holmes, Watson, Moriarty, and BLADE should accept module-provided domain
  behavior instead of hard-coded product semantics

This document names the capability surfaces that a module may contribute.

## Core Rule

> Wesley ships engines and extension points, not product semantics.

That means:

- base Wesley owns the verbs
- modules own domain targets, domain checks, domain policies, and domain test
  scenarios
- projects select modules explicitly

## Inputs, Extensions, Outputs

Keep these separate.

### Inputs

What the project supplies:

- GraphQL schemas
- selected modules
- module config
- optional project tests and BLADE hooks

### Extensions

What a module contributes:

- directive semantics
- compile targets and generators
- Holmes checks and witness scopes
- Watson verifiers
- Moriarty policy and judgment profiles
- BLADE scenarios, fixtures, and gates
- optional CLI commands

### Outputs

What Wesley and the toolchain emit:

- compiled artifacts
- evidence bundles
- judgment bundles
- certified deployable bundles or failure bundles

Wesley does not emit runtime values. Runtimes and tools later emit values that
conform to GraphQL-authored families.

## Module Capability Areas

A loadable module may contribute capabilities in these areas.

### 1. Wesley capabilities

These extend the compiler/toolchain surface directly.

Examples:

- directive semantics
- compile targets
- generators
- bundle profiles
- realization verifiers

This is the capability set `wesley compile` and related base verbs should use.

### 2. Holmes capabilities

These extend structural witness and evidence gathering.

Examples:

- witness scopes
- structural checks
- evidence collectors
- drift rules

### 3. Watson capabilities

These extend evidence verification and audit logic.

Examples:

- citation verifiers
- consistency checks
- score/math verification rules
- audit profiles

### 4. Moriarty capabilities

These extend policy, judgment, and prediction.

Examples:

- policy profiles
- judgment rules
- predictor models
- risk classification rules

### 5. BLADE capabilities

These extend release-readiness orchestration.

Examples:

- test scenarios
- fixtures
- environment setup hooks
- extra tests
- gate rules
- certification profiles

### 6. CLI capabilities

These add module-owned user-facing commands.

Examples:

- Continuum-specific commands
- module-local doctor or report commands

CLI capabilities are useful, but they are not the whole module story.

## Capability Shape

The module contract should evolve toward a shape like this:

```js
{
  apiVersion: '1',
  name: 'continuum',

  init(config) {},

  capabilities: {
    wesley: {
      directives: [],
      targets: [],
      generators: [],
      bundleProfiles: [],
      realizationVerifiers: []
    },
    holmes: {
      scopes: [],
      checks: [],
      evidenceCollectors: []
    },
    watson: {
      verifiers: [],
      auditProfiles: []
    },
    moriarty: {
      policyProfiles: [],
      judgmentProfiles: [],
      predictors: []
    },
    blade: {
      scenarios: [],
      fixtures: [],
      envSetups: [],
      tests: [],
      gates: [],
      certificationProfiles: []
    },
    cli: {
      commands: []
    }
  }
}
```

This is a target contract shape, not a promise that the current runtime already
implements every registry.

## Required Versus Optional

Modules do not need to implement every capability area.

A module may contribute only one slice.

Examples:

- a small technology module may only register `wesley.targets`
- a policy-heavy module may contribute only Moriarty and BLADE capabilities
- a product module like Continuum may contribute across every area

The important rule is:

> if domain behavior exists, it should come from a module capability, not from
> hard-coded base-platform imports.

## Compile Must Use Module Targets

`wesley compile` remains a Wesley base-platform verb.

What changes is how it decides what to compile.

It should:

- ask loaded modules for available compile targets
- validate requested targets against the loaded registry
- dispatch generation through those module-provided targets

It should not:

- hard-code `echo`
- hard-code `warp-ttd`
- hard-code Postgres or Supabase target semantics

That is the central design consequence of this note.

## Continuum Module Under This Contract

The Continuum module should contribute capabilities such as:

- `wesley.targets`
  - `warp-ttd`
  - `echo`
- `wesley.generators`
  - TTD generator
  - Echo generator
- `wesley.realizationVerifiers`
  - Continuum realization verifier
- `holmes`
  - Continuum witness scopes
  - `git-warp` counterfactual provider
- `moriarty`
  - Continuum policy and judgment profiles
- `blade`
  - Continuum scenarios, fixtures, and gates
- `cli`
  - Continuum-specific helper commands

Observer-anything remains Continuum-only, but it still enters through
GraphQL-authored contract families and module capabilities, not through generic
Wesley.

## Postgres Module Under This Contract

The Postgres module should contribute capabilities such as:

- `wesley.targets`
  - `postgres-sql`
  - `postgres-tests`
  - `supabase`
- `wesley.generators`
  - DDL emitters
  - RLS emitters
  - pgTAP emitters
- `holmes`
  - migration witness scopes
  - lock and risk checks
- `watson`
  - artifact verification for SQL/test outputs
- `moriarty`
  - migration risk policy profiles
- `blade`
  - database test scenarios
  - fixture DB setup
  - release gates for migration readiness

The Postgres module does **not** define observers.

## Project Experience

Ordinary projects should not hand-wire all of this.

A project should mainly say:

- here are my GraphQL schemas
- here are the modules I use
- here is any module config
- here are any extra project tests or BLADE hooks

That is the whole point of modules.

## Test Strategy

Wesley core CI must not depend on Continuum or Postgres repos being present.

So Wesley should keep a hermetic fixture module in its own tests that proves:

- module loading works
- capability registration works
- `compile` can discover module-owned targets

That fixture is a test artifact, not a product module.

## Migration Consequences

This note implies the following work order:

1. expand the `WesleyModule` contract to expose capabilities beyond CLI commands
2. add capability registries in base Wesley
3. rewrite `wesley compile` to use module-owned target discovery
4. convert Continuum to the new capability contract
5. convert Postgres to the new capability contract
6. remove remaining hard-coded domain imports from Wesley

## Current Honest Posture

Today Wesley has:

- explicit module loading
- module-owned CLI command registration

Today Wesley does **not** yet have:

- a real capability registry
- module-driven compile target discovery
- module-provided Holmes/Watson/Moriarty/BLADE registries

So this document is the next contract to implement, not a claim that the work
is already complete.
