# Wesley Module Contract

<!-- docs-truth: status=current owner=@flyingrobots -->

This note freezes the module boundary for Wesley.

It exists to answer three questions cleanly:

1. What belongs in Wesley base platform?
2. What belongs in a module?
3. What must an ordinary project provide directly?

The most important rule is simple:

> Wesley owns the compiler kernel. Modules bring every domain target.

Generic Wesley does not define product nouns, database nouns, observer nouns,
or runtime-family nouns. If a domain needs them, the owning external module
defines them outside this repo.

Observer-anything is an external module concern. If Continuum needs observer
contracts, Continuum owns them in the Continuum repo or a Continuum-owned module
repo, not in Wesley.

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

- product-specific families
- database-specific families
- project-specific publication boundaries
- consumer-specific projection policy
- observer nouns

### 1. Wesley Extension Modules

Modules extend the base platform through explicit hooks and live outside the
core repository unless they are hermetic test fixtures or genuinely generic
helpers.

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

- a language generator module
- a database-family module in an external repo
- a product-family module in that product's repo
- a project-local module

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

The concrete capability areas that should back that contract are defined in
[Wesley Module Capability Contract](./wesley-module-capability-contract.md).

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

- `billing-family`
- `inventory-family`
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

## Contract Families Versus Artifacts Versus Values

Wesley must keep three different layers distinct:

- contract families authored in GraphQL
- compiled artifacts emitted by Wesley
- runtime values later produced by tools or runtimes using those artifacts

Modules extend the meaning of authored GraphQL families and the artifacts
emitted from them.

Modules do **not** change the rule that Wesley stops at artifact emission.

If a module defines domain-specific families, Wesley may compile code and
manifests for those families. It does not emit actual runtime values conforming
to them.

## External Product Extension Surface

An external product module may define additional nouns that generic Wesley does
not own.

Those may include:

- GraphQL-authored product families
- compiled observer state codecs and related artifacts
- hosted observer runtime contracts that later produce values conforming to
  those families

These belong outside Wesley because they depend on product runtime semantics
that are not generic compiler truth.

Database and other non-product modules should use simpler read-side nouns such
as reports, projections, inspections, summaries, and certification results.

## Immediate Consequences

This note implies the following changes.

### 1. Domain commands are not generic Wesley features

Commands such as product observer planning, target-specific bundling, or
database migration planning should be treated as external module features.

### 2. Product ownership belongs in product repos

The old Wesley-side product packages were bootstrap. Real product modules and
profile surfaces belong in their owning repos.

### 3. Wesley needs external module loading

If modules are going to live outside the Wesley repo, Wesley needs a clean way
to load them without hardcoding product semantics into the base platform.

The first practical seam for this is a module-manifest loader and
module-owned CLI registration path. That is enough to let Wesley load external
modules and enough to move domain-specific commands off the generic
command-discovery path.

### 4. Database and Postgres semantics should leave Wesley

Database-specific generation, migration explanation, lock semantics, adapters,
and similar domain logic do not belong in the base compiler repo.

## Migration Order

The clean migration sequence is:

1. lock the module contract in docs
2. add a generic external module loading seam
3. move product modules out of the Wesley repo
4. retarget domain-specific commands to loaded modules
5. extract database and Postgres semantics into `wesley-postgres`

That order reduces churn and avoids pretending the boundary is already real when
the loader does not exist yet.

## Current Honest Posture

Wesley now has the beginnings of the loader seam it needs.

The current posture is:

- generic core owns the `WesleyModule` contract
- CLI can discover and register module-owned command surfaces
- generic Wesley loads no domain modules by default
- modules are loaded explicitly through `wesley.config.mjs` or `WESLEY_MODULES`
- product and database modules must live outside Wesley

That is not the final architecture. It is the bridge that lets the real
architecture happen without a rewrite.
