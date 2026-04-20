# Wesley Module Contract
<!-- docs-truth: status=current owner=@flyingrobots -->

This note freezes the module boundary for Wesley.

It exists to answer three questions cleanly:

1. What belongs in Wesley base platform?
2. What belongs in a module?
3. What must an ordinary project provide directly?

The most important rule is simple:

> Observer-anything is Continuum-only.

Generic Wesley does not define observer nouns. Non-Continuum modules do not
need an observer story. The Continuum module is allowed to add one because it
is the only lane in this stack that actually needs holographic runtime
observers.

## Layers

### 0. Wesley Base Platform

The base platform includes:

- the Wesley compiler
- Holmes and Watson witness and verification tooling
- Moriarty judgment and prediction tooling
- BLADE certification and release-readiness orchestration
- generic CLI, hosts, and shared plumbing

This layer must stay project-agnostic.

It may define:

- schema and directive handling
- IR and compile pipeline
- generator plugin contracts
- bundle primitives
- witness, judgment, and certification plumbing

It must not define:

- Continuum-specific families
- project-specific publication boundaries
- consumer-specific projection policy
- observer nouns

### 1. Wesley Extension Modules

Modules extend the base platform through explicit hooks.

A module may add:

- GraphQL directives
- generators and target emitters
- bundle or release profiles
- witness scopes and verification profiles
- judgment profiles
- BLADE environment and gate hooks
- module-owned user-facing commands or helpers

Modules are where domain meaning lives.

Examples:

- a Database module
- a Postgres submodule
- a Continuum module

### 2. Project Workspace

The project workspace is the user's actual repo.

An ordinary project should usually provide only:

- authored schemas
- selected module(s)
- module configuration
- optional project tests
- optional BLADE environment setup and extra test hooks

An ordinary project should not need to hand-author all of the following from
scratch:

- witness scopes
- publication-boundary rules
- consumer projection defaults
- judgment profiles
- release/sync defaults

Those are module responsibilities.

## What A Module Must Provide

The generic module contract should be read as a family of optional extension
surfaces, not as a demand that every module implement every hook.

A serious module may provide:

- compiler directives and generators
- bundle identities and defaults
- witness scopes
- report or certification profiles
- judgment profiles
- BLADE hooks
- module-owned CLI surfaces

The important thing is that these come from the module, not from hand-wired
project folklore.

## What A Family Is

A family is a bounded authored contract slice that is versioned, compiled,
witnessed, and released as one unit.

Examples:

- `receipt-family`
- `settlement-family`
- `runtime-boundary-family`

A family is not the same thing as a scope or a projection.

- family = the authored unit
- scope = what a witness or certification act claims about that unit
- projection = how one consumer receives artifacts derived from that unit

That distinction keeps release, proof, and consumer sync from collapsing into
one mushy noun.

## Publication-Boundary Policy

Publication-boundary policy says where a family is allowed to live and where its
generated projections are allowed to land.

In practice, it prevents:

- handwritten shadow contracts outside the authored home
- stray generated artifacts leaking into random repo roots
- accidental peer authorities growing next to the canonical schema

This is an anti-shadowing rule, not a metaphysical theorem.

The base platform may provide generic enforcement machinery, but the actual
policy should be supplied by modules.

## Continuum-Only Extension Surface

The Continuum module is allowed to define additional nouns that generic Wesley
does not own.

Those include:

- `ObserverSpec`
- `ObserverPlan`
- observer state codecs
- reading envelopes
- hosted observer runtime contracts

These are Continuum-only because they depend on WARP runtime semantics that are
not generic compiler truth.

Postgres and other non-Continuum modules should use simpler read-side nouns such
as reports, projections, inspections, summaries, and certification results.

## Immediate Consequences

This note implies the following changes.

### 1. `observer-plan` is not a generic Wesley feature

It should be treated as a Continuum-module feature.

### 2. `@wesley/continuum` is in the wrong repo long-term

It is useful as a bootstrap package today, but the real Continuum module should
ultimately live in the Continuum repo.

### 3. Wesley needs external module loading

If modules are going to live outside the Wesley repo, Wesley needs a clean way
to load them without hardcoding product semantics into the base platform.

The first practical seam for this is a module-manifest loader and
module-owned CLI registration path. That is enough to let Wesley load external
modules and enough to move Continuum-specific commands off the generic
command-discovery path.

### 4. Database and Postgres semantics should leave `wesley-core`

Database-specific generation, migration explanation, lock semantics, and
similar domain logic do not belong in the pure base compiler.

## Migration Order

The clean migration sequence is:

1. lock the module contract in docs
2. add a generic external module loading seam
3. move the Continuum module out of the Wesley repo
4. retarget Continuum-specific commands to the loaded module
5. extract database and Postgres semantics from `wesley-core` into a real
   module

That order reduces churn and avoids pretending the boundary is already real when
the loader does not exist yet.

## Current Honest Posture

Wesley now has the beginnings of the loader seam it needs.

The current posture is:

- generic core owns the `WesleyModule` contract
- CLI can discover and register module-owned command surfaces
- Continuum still ships as a default-loaded bootstrap module inside the Wesley
  repo

That is not the final architecture. It is the bridge that lets the real
architecture happen without a rewrite.
