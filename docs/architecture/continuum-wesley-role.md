# Wesley Role In Continuum

<!-- docs-truth: status=current owner=@flyingrobots -->

This note states Wesley's current operating role in Continuum. It complements
[Continuum Minimum Shared Contract Surface](./continuum-minimum-shared-contract-surface.md)
by naming the jobs Wesley owns once a shared noun family is admitted into the
compiler path, and by naming the neighboring responsibilities Wesley must not
absorb.

## One-Sentence Role

Wesley is Continuum's contract compiler, publication-boundary manager,
conformance anchor, and judgment bridge. It keeps authored shared contracts,
derived artifacts, and operator-facing judgment coherent without claiming
runtime, storage, debugger, or substrate-fact ownership.

## Read This With The Right Split

This note describes Wesley's role in Continuum, not the essence of Wesley core.

The important split is:

- **Wesley core** is a compiler: authored contract in, generated artifacts out
- **the wider Wesley toolchain** also carries realization, witness, release,
  sync, and judgment helpers around those artifacts
- **Continuum** still owns its schemas, manifests, and user-facing orchestration
  concerns

During the domain-empty extraction, generic Wesley retired the public
`compile-ttd` and `bundle-echo` CLI commands. Any future Continuum compile or
bundle surface should enter through a Continuum-owned module command or
external package.

So when this note says Wesley owns publication-boundary management or
conformance anchoring, read that as a Wesley-side toolchain role layered around
the compiler, not as a claim that the compiler core itself has become
Continuum-specific.

## Wesley Owns Four Jobs

### 1. Contract Compiler

Wesley treats GraphQL SDL as authored contract, not as an API veneer over some
other hidden source of truth. For the shared noun families it carries, Wesley
validates schema, computes identity-bearing hashes, lowers contract shape into
IR and manifests, and emits deterministic language-facing artifacts.

For Continuum's graph and rewrite boundary, this means Wesley is responsible
for compiling authored families that define:

- graph entities such as nodes and edges
- graph rewrite declarations
- declared footprints and capability boundaries
- static slot, binding, and closure grammar for rewrites whose concrete runtime
  focus is only known at execution time
- types that cross Rust, TypeScript, WASM, process, or network boundaries

The Continuum module should also grow a lawful observer compiler boundary:

- app-authored observer specs for the optic's get side
- compiled observer plans consumed by generic runtimes
- observer-state codecs
- reading/result codecs
- hologram or frontier-adjacent envelope helpers

The important distinction is that observer-anything is Continuum-only. Generic
Wesley provides the extension seam and compile plumbing. The Continuum module
owns the static observer law. Echo owns hosted observer instance state at
runtime.

This does **not** mean Wesley owns the whole program. Echo, `git-warp`, and
other consumers remain free to keep runtime internals and handwritten engine
logic local. Wesley owns the shared lawful boundary that those engines consume.

The intended enforcement story is capability-bounded code generation, not
post-hoc narration. When a rewrite declares one footprint, Wesley's generated
surfaces should make that honesty explicit enough that dishonest use becomes
auditable or a compile-time failure rather than a convention.

For dynamic graph rewrites, that means Wesley should treat:

- slots, binding sources, closure operators, create/update surfaces, and
  forbidden surfaces as static authored contract
- concrete node ids, current-head relations, and derived local closures as
  runtime bindings supplied or resolved by the consumer engine

Current repo-visible evidence:

- `warp-ttd` owns `schemas/warp-ttd-protocol.graphql`
- `echo` owns current runtime schema fragments and ABI/runtime crates; old
  Wesley-local Echo SDL is tracked as reconciliation work there
- `continuum` owns `schemas/continuum-receipt-family.graphql` and
  `schemas/continuum-settlement-family.graphql`
- relocated Continuum-owned implementation at `continuum/wesley/ttd/`
- `docs/design/wesley-extraction-map.md`

### 2. Publication-Boundary Manager

Wesley makes the publication boundary explicit so neighboring repos do not have
to guess which file is authored, generated, stable to consume, or merely a
local mirror.

For each admitted shared noun family, Wesley should make four things easy to
name:

1. the authored home for the contract
2. the Wesley compile path that consumes it
3. the stable generated artifact family consumers are expected to read
4. any handwritten mirrors, adapters, or local helper files that are not peer
   authority

Current repo-visible evidence:

- `docs/architecture/continuum-minimum-shared-contract-surface.md`
- relocated Continuum-owned implementation at
  `continuum/wesley/ttd/codegen/orchestrator.mjs`
- `docs/design/wesley-extraction-map.md`

Current rule:

- Wesley may compile from an authored home it carries locally or from an
  explicit foreign-authored home.
- Either way, the authored home must be named directly.
- Generated artifacts may be stable consumer surfaces.
- Mirrors do not inherit authorship just because they exist.
- Consumer repos should normally consume a released contract bundle or one of
  its generated projections, not Wesley compiler internals.
- `@wesley/continuum` is a Wesley-side product profile for commands and
  reports, not the universal runtime dependency every consumer repo should
  import.

### 3. Conformance Anchor

Wesley is responsible for making contract drift inspectable. The compiler path
is not enough by itself; the repo also needs a witness lane showing that the
generated surfaces are deterministic and coherent.

Wesley therefore carries two different proof-adjacent surfaces:

- a **realization manifest** emitted by `wesley compile`, proving build
  traceability for one authored schema and its generated legs
- a **conformance witness** emitted by `wesley witness`, with
  `wesley witness-continuum` kept as a compatibility alias, proving one
  bounded cross-leg coherence and anti-shadow check set

Current repo-visible evidence:

- owner-provided schemas in `warp-ttd`, `echo`, and `continuum`
- `docs/design/wesley-extraction-map.md`

Current rule:

- if a shared noun family is in Wesley's Continuum surface, schema edits happen
  at the authored home and conformance evidence must still pass after
  regeneration
- realization manifest is not conformance witness
- conformance witness output is proof of one bounded compile path, not proof that the full
  platform is finished

### 4. Judgment Bridge

Wesley turns substrate facts into operator-facing meaning. That is the judgment
side of the Continuum split: Wesley emits status, signals, risk class,
confidence adjustment, gate result, and human explanation, while refusing to
reimplement the fact layer underneath it.

Current repo-visible evidence:

- `docs/architecture/holmes-counterfactuals.md`
- `packages/wesley-continuum/src/judgment-profile.mjs`
- `packages/wesley-holmes/src/counterfactual/provider.mjs`
- `packages/wesley-holmes/src/moriarty-predict-workflow.mjs`

Current rule:

- substrate facts come from substrate-capable tools and adapters
- Wesley translates those facts into judgment-bearing outputs for operators and
  automation
- Continuum-specific judgment profiles may live in `@wesley/continuum`, while
  shared Holmes/Watson/Moriarty execution stays in `@wesley/holmes`

## Admission Rule For A Shared Noun Family

A Continuum shared noun family only belongs in Wesley's role when all of the
following are true:

1. one authored home is named
2. one Wesley compile path consumes that authored home
3. one stable generated artifact family is named for consumers
4. one local witness surface proves the chosen compile path remains coherent

If any of those are missing, the family is still target-state or advisory. Do
not fill the gap with handwritten shadow contracts.

## Recommended Release Surface

The recommended release surface for an admitted Continuum family is one
versioned contract bundle that binds:

- human release semver
- exact admitted schema identity
- generated target projections
- realization shell metadata
- witness output for the named scope

That bundle may produce language-specific package projections, but those remain
projections of the bundle rather than independent authorities. For the release
model behind this recommendation, see
`docs/design/0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md`.

## Boundary Map

| Neighbor                  | Wesley does                                                                                                             | Wesley does not do                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Echo                      | Compile shared contract artifacts and keep schema, codec, manifest, and registry meaning stable for hot-side consumers. | Own hot-runtime rewrite semantics, storage behavior, or runtime policy.                   |
| `git-warp`                | Consume canonical substrate facts and derive Wesley-native judgment from them.                                          | Own comparison, transfer planning, visible-state normalization, or canonical fact export. |
| `warp-ttd`                | Support host-neutral protocol families with explicit compile and publication boundaries.                                | Own debugger UX, playback policy, observer behavior, or tool-local mirrors.               |
| HOLMES / Moriarty / BLADE | Turn compiled surfaces plus substrate facts into readiness, forecast, and gate outputs.                                 | Replace substrate tools or smuggle runtime semantics into product judgment.               |

Neighboring repos may author some shared noun families. Wesley's job is to
keep the compile path, publication boundary, and proof surface explicit, not to
claim authorship by default.

## Wesley Does Not Own

- WARP substrate ontology or runtime semantics
- Echo or `git-warp` storage behavior
- debugger policy or observer UX
- canonical substrate fact extraction
- handwritten shadow contracts for admitted shared noun families
- proof by narration without a local compile path and witness surface

## Current Limiting Truth

Continuum now carries authored `schemas/continuum-receipt-family.graphql` and
`schemas/continuum-settlement-family.graphql`, and the Continuum Wesley module
ships real `receipt-family` and `settlement-family` witness scopes through
`wesley witness`. That means the stack can now prove bounded local
contract-family paths from owner-authored schemas through TTD and Echo legs to
conformance witnesses. This note still does not claim that the whole Continuum
contract surface is frozen, or that Wesley owns runtime, storage, debugger, or
substrate semantics outside those bounded proof lanes. The release and sync
shape for turning those bounded proofs into one boring consumer bundle now
lives in
`docs/design/0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md`.
