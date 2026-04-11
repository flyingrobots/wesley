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

## Wesley Owns Four Jobs

### 1. Contract Compiler

Wesley treats GraphQL SDL as authored contract, not as an API veneer over some
other hidden source of truth. For the shared noun families it carries, Wesley
validates schema, computes identity-bearing hashes, lowers contract shape into
IR and manifests, and emits deterministic language-facing artifacts.

Current repo-visible evidence:

- `schemas/ttd-protocol.graphql`
- `schemas/echo-core-types.graphql`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-core/src/ttd/`
- `packages/wesley-generator-echo/src/EchoPlugin.mjs`

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
- `packages/wesley-core/src/ttd/codegen/orchestrator.mjs`
- `packages/wesley-cli/test/compile-ttd.bats`
- `packages/wesley-generator-echo/README.md`

Current rule:

- Wesley may compile from an authored home it carries locally or from an
  explicit foreign-authored home.
- Either way, the authored home must be named directly.
- Generated artifacts may be stable consumer surfaces.
- Mirrors do not inherit authorship just because they exist.

### 3. Conformance Anchor

Wesley is responsible for making contract drift inspectable. The compiler path
is not enough by itself; the repo also needs a witness lane showing that the
generated surfaces are deterministic and coherent.

Wesley therefore carries two witness strengths:

- a **compile witness** emitted by `wesley compile`, proving build traceability
  for one authored schema and its generated legs
- a **conformance witness** emitted by `wesley witness-continuum`, proving one
  bounded cross-leg coherence and anti-shadow check set

Current repo-visible evidence:

- `packages/wesley-cli/test/compile-ttd.bats`
- `packages/wesley-generator-echo/test/core-types.test.mjs`
- `packages/wesley-generator-echo/test/privacy-types-encoding.test.mjs`
- `packages/wesley-generator-echo/test/golden-vectors/privacy-types.json`

Current rule:

- if a shared noun family is in Wesley's Continuum surface, schema edits happen
  at the authored home and conformance evidence must still pass after
  regeneration
- compile witness is not conformance witness
- conformance witness output is proof of one bounded compile path, not proof that the full
  platform is finished

### 4. Judgment Bridge

Wesley turns substrate facts into operator-facing meaning. That is the judgment
side of the Continuum split: Wesley emits status, signals, risk class,
confidence adjustment, gate result, and human explanation, while refusing to
reimplement the fact layer underneath it.

Current repo-visible evidence:

- `docs/architecture/holmes-counterfactuals.md`
- `packages/wesley-holmes/src/counterfactual/provider.mjs`
- `packages/wesley-holmes/src/moriarty-predict-workflow.mjs`

Current rule:

- substrate facts come from substrate-capable tools and adapters
- Wesley translates those facts into judgment-bearing outputs for operators and
  automation

## Admission Rule For A Shared Noun Family

A Continuum shared noun family only belongs in Wesley's role when all of the
following are true:

1. one authored home is named
2. one Wesley compile path consumes that authored home
3. one stable generated artifact family is named for consumers
4. one local witness surface proves the chosen compile path remains coherent

If any of those are missing, the family is still target-state or advisory. Do
not fill the gap with handwritten shadow contracts.

## Boundary Map

| Neighbor | Wesley does | Wesley does not do |
| --- | --- | --- |
| Echo | Compile shared contract artifacts and keep schema, codec, manifest, and registry meaning stable for hot-side consumers. | Own hot-runtime rewrite semantics, storage behavior, or runtime policy. |
| `git-warp` | Consume canonical substrate facts and derive Wesley-native judgment from them. | Own comparison, transfer planning, visible-state normalization, or canonical fact export. |
| `warp-ttd` | Support host-neutral protocol families with explicit compile and publication boundaries. | Own debugger UX, playback policy, observer behavior, or tool-local mirrors. |
| HOLMES / Moriarty / BLADE | Turn compiled surfaces plus substrate facts into readiness, forecast, and gate outputs. | Replace substrate tools or smuggle runtime semantics into product judgment. |

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

Wesley now carries an authored `schemas/continuum-receipt-family.graphql` and
a real receipt-family witness scope through
`wesley witness-continuum --scope receipt-family`. That means the repo can now
prove one local contract-family stack from authored schema through TTD and Echo
legs to a bounded conformance witness. This note still does not claim that the
whole Continuum contract surface is frozen, or that Wesley owns runtime,
storage, debugger, or substrate semantics outside that bounded proof lane.
