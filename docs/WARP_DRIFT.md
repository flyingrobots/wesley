<!-- docs-truth: status=current owner=@flyingrobots -->

# Wesley WARP Drift

This note captures where Wesley currently drifts from the stronger WARP
doctrine now shared across `blog`, `continuum`, `echo`, `warp-ttd`, and app
repos such as `jedit`.

It is not a claim that Wesley is pointed the wrong way. Wesley is already
carrying several of the right ideas. The drift is now best described as a
module-boundary drift: too much Continuum-specific policy still lives inside
generic Wesley surfaces, while some non-Continuum domain semantics still leak
into core.

## The current WARP baseline

The relevant baseline is now:

- there is no canonical materialized graph-in-itself; shared runtime truth is
  witnessed causal history and observer-relative readings over that history
- the same admission kernel recurs across tick admission, braid comparison,
  and distributed suffix import, differing mainly by normalization path
- observer-anything is Continuum-only, not a generic Wesley feature
- modules should own domain semantics, witness policy, bundle defaults, and
  publication-boundary rules
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
- Wesley already has a real generator/plugin seam and bundle-oriented
  toolchain surfaces
- release and sync are already understood as publication-boundary work rather
  than ad hoc file copying

That means the current problem is not that Wesley lacks doctrine. The problem
is that the current repo still mixes base-platform truth and module-owned truth.

## Where Wesley is drifting

### 1. Continuum-specific policy still lives inside Wesley

The current repo still carries Continuum-specific policy and commands directly
inside Wesley surfaces:

- `@wesley/continuum` lives in the Wesley repo
- Continuum-specific commands are part of the generic CLI
- `observer-plan` is presented as a Wesley command even though observer nouns
  are Continuum-only

That was acceptable bootstrap. It is now the wrong long-term ownership split.

### 2. Observer surfaces are still framed as generic Wesley work

Wesley still carries:

- a generic-looking observer design packet
- a generic-looking `observer-plan` command

That is now architecturally misleading.

Observer-anything belongs to the Continuum module, not to the Wesley base
platform and not to non-Continuum modules such as Postgres.

### 3. Database and Postgres semantics still leak into `wesley-core`

The generic compiler base still exports database-specific logic such as:

- Postgres generation
- pgTAP generation
- migration explanation
- lock semantics and related database-specific helpers

That makes core less honest than it should be. Those semantics belong in a
database module, not in the pure compiler base.

## What Wesley should look like next

The correction path is straightforward.

### First: define and preserve the generic module contract

Wesley should freeze the rule that modules, not ordinary projects, own:

- witness scopes
- publication-boundary policy
- consumer projection defaults
- judgment profiles
- BLADE hooks
- domain-specific compile and release defaults

And observer nouns should be explicitly absent from the generic module
contract.

### Second: move the Continuum module out of Wesley

The real Continuum module should live in the Continuum repo and be loaded by
Wesley, not housed inside generic Wesley.

That implies:

- external module loading in Wesley
- Continuum-owned module policy in the Continuum repo
- retargeted Continuum-specific CLI surfaces that load the module rather than
  importing it statically

### Third: move database and Postgres semantics into a database module

The same ownership logic applies to database semantics.

Core should keep generic compiler machinery. Database-specific generation and
analysis should move into a real module or module family.

## Immediate backlog

The highest-value next notes are now:

- [Module Contract](./design/wesley-module-contract.md)
- [0007 — Continuum observer spec and plan](./design/0007-observer-spec-and-plan/observer-spec-and-plan.md)
- [Wesley role in Continuum](./architecture/continuum-wesley-role.md)
- [SOURCE_continuum-runtime-boundary-family-compiler-lane](./method/backlog/asap/SOURCE_continuum-runtime-boundary-family-compiler-lane.md)
- [SOURCE_continuum-lane-identity-family-boundary](./method/backlog/up-next/SOURCE_continuum-lane-identity-family-boundary.md)

## Practical rule

Wesley should stay the contract compiler and publication-boundary manager.

What must change is what the repo still tries to own directly:

- not Continuum-specific observer surfaces in generic Wesley
- not Continuum policy housed permanently in the Wesley repo
- not database semantics leaking through `wesley-core`

The next honest Wesley cut is to make the module boundary real in code, not
just in docs.
