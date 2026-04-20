# Wesley Pipeline
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This note explains the Wesley stack as a bundle pipeline.

It is meant to help with two jobs:

- architecture thinking
- onboarding new users and maintainers

The names in this note such as `WesleyInputBundle` or `HolmesOutputBundle` are
currently **conceptual bundle names**, not frozen wire contracts. They describe
the shape of the stack as it should be understood today.

## Keep Three Layers Distinct

This note assumes one hard boundary:

- GraphQL-authored contract families
- Wesley-emitted compiled artifacts
- later runtime or tool values

Wesley only owns the middle layer.

If a family such as `TickResult` or `ReadingEnvelope` exists, Wesley may
compile code, tests, manifests, and registries for that family. Wesley does
**not** emit actual `TickResult` or `ReadingEnvelope` values. Runtimes and
tools later do that.

## One-Line Shape

The base pipeline is:

```text
Wesley -> Holmes -> Watson -> Moriarty -> BLADE
```

That is the easiest mental model.

The more honest operational model is:

```text
WesleyOutputBundle
  -> Holmes
  -> Watson

HolmesOutputBundle + WatsonOutputBundle + history/runtime/counterfactual context
  -> Moriarty

WesleyOutputBundle + HolmesOutputBundle + WatsonOutputBundle + MoriartyOutputBundle
+ project test/environment extensions
  -> BLADE
```

So the stack is conceptually sequential, but operationally it partly fans out
and then fans back in.

## Stage 1: Wesley

Wesley is the GraphQL compiler.

### Input

`WesleyInputBundle`

This should be thought of as containing:

- authored GraphQL schemas
- directives
- optional operations and compile config
- target selection
- compile context

### Output

`WesleyOutputBundle`

This should be thought of as containing:

- generated source files
- generated tests
- schema-to-source mappings
- realization shell / manifest
- emitted artifact inventory
- source identity and traceability metadata

The important correction is that this is **not just a source-code bundle**. It
is the compiled artifact bundle for one compile act.

### What Wesley Proves

Wesley proves that authored GraphQL was lowered and emitted into derived
artifacts.

Wesley by itself does **not** prove:

- runtime correctness
- runtime values were emitted
- policy compliance
- deployability
- production health

## Stage 2: Holmes

Holmes is the structural investigation and evidence scoring stage.

### Input

`WesleyOutputBundle`

### Output

`HolmesOutputBundle`

Current repo truth says Holmes emits a structured report that includes:

- metadata
  - generated time
  - source SHA
  - verification status and count
  - bundle version
  - evidence trust and citation quality
- scores
  - `scs`
  - `tci`
  - `mri`
- breakdown
  - structural coverage details
  - test/conformance details
  - migration risk details
- evidence entries
  - element
  - weight
  - status
  - evidence strength
  - deduction
- gates
  - gate name
  - ruling
- verdict
  - code
  - message
  - markdown

### What Holmes Does

Holmes answers:

> What does the generated bundle appear to say about structural completeness,
> test/conformance coverage, and migration risk?

### What Holmes Does Not Do

Holmes does not deploy, and it does not turn evidence into final release
judgment by itself.

Holmes produces a tool output bundle, not a runtime value stream.

## Stage 3: Watson

Watson is the verification and evidence-audit stage.

### Input

Today, Watson effectively reads the same `WesleyOutputBundle` surface that
Holmes reads.

In the cleaner future model, Watson should be thought of as consuming:

- `WesleyOutputBundle`
- optionally `HolmesOutputBundle`

That future model is useful because it lets Watson verify not just raw bundle
facts, but also Holmes' claimed deductions.

### Output

`WatsonOutputBundle`

Current repo truth says Watson emits a structured report that includes:

- metadata
- citations
  - total
  - verified
  - failed
  - unverified
  - exact
  - whole-file
  - coarse
  - trust
  - reasons
  - rate
- math
  - claimed SCS
  - recalculated SCS
  - difference
  - acceptable
- inconsistencies
- opinion
  - verdict
  - message
  - markdown

### What Watson Does

Watson answers:

> Is the evidence chain itself trustworthy, well-cited, internally consistent,
> and mathematically coherent?

### What Watson Does Not Do

Watson does not replace Holmes. It audits the integrity of the evidence and
reasoning surface.

Watson produces a tool output bundle, not a runtime value stream.

## Stage 4: Moriarty

Moriarty is the policy, judgment, and prediction stage.

### Input

`MoriartyInputBundle`

This is not just "the previous bundle." Current repo truth says Moriarty needs:

- `HolmesOutputBundle`
- `WatsonOutputBundle`
- historical score/run context
- optional runtime context
- optional counterfactual context

You can include `WesleyOutputBundle` in the conceptual model, but the key point
is that Moriarty judges using evidence plus context, not compilation alone.

### Output

`MoriartyOutputBundle`

Current repo truth says Moriarty emits a structured report that includes:

- metadata
- status
- historical points
  - `scs`
  - `tci`
  - `mri`
  - evidence trust
- latest summary
- velocity
- plateau/regression detection
- ETA
- confidence
- patterns and warnings
- optional runtime block
- optional counterfactual block
  - requested refs
  - resolved refs
  - substrate facts
  - normalized scope
  - judgment
    - status
    - signals
    - risk class
    - confidence adjustment
    - gate
    - would-fail
    - reasons

### What Moriarty Does

Moriarty answers:

> Given the evidence, trust quality, history, and policy, what should we
> believe, what should we predict, and how hard should we gate?

### What Moriarty Does Not Do

Moriarty does not compile artifacts and does not certify release readiness by
itself. It produces judgment.

That judgment is a tool output bundle, not a runtime value stream.

## Stage 5: BLADE

BLADE is the certification and release-readiness orchestrator.

### Input

`BladeInputBundle`

This should be thought of as containing:

- `WesleyOutputBundle`
- `HolmesOutputBundle`
- `WatsonOutputBundle`
- `MoriartyOutputBundle`
- project environment setup rules
- project test configuration
- project-specific additional tests

That last group matters. Projects may need to extend BLADE so it knows:

- how to stage a test environment
- which generated tests to run
- which project-owned tests to run
- which extra certification gates to honor

### Output

`BladeOutputBundle`

There are really two useful output shapes:

#### Certified Deployable Bundle

A tested and certified release-readiness bundle containing:

- compiled artifacts
- realization shell
- Holmes report
- Watson report
- Moriarty report
- test results
- certification outputs such as SHIPME, signatures, badges, or readiness verdicts

#### Uncertified Failure Bundle

A failed readiness bundle containing:

- the same core evidence surfaces
- failing tests or failing gates
- blocked certification state
- reasons and diagnostics

### What BLADE Does

BLADE answers:

> Is this project plus generated bundle ready to be treated as deployable?

### What BLADE Does Not Do

BLADE stops short of deployment.

It may produce a **certified, tested, deployable bundle**, but the actual
deployment belongs to the project or operator layer.

Wesley should certify deployability, not perform deployment.

BLADE emits certification/readiness outputs. It does not pretend those outputs
are runtime values from the deployed system.

## Current Honest Posture

This is the most important caveat in the note.

Today:

- the bundle names in this note are mostly conceptual
- Holmes and Watson both still read the Wesley bundle directly
- Moriarty already clearly depends on extra context, not just prior reports
- BLADE is documented and implemented as a one-shot orchestrator over transform,
  plan, rehearse, counterfactual, and certificate flows

So this note should be read as:

- a correct architectural mental model
- a clean onboarding surface
- a target for future explicit contract shaping

It should **not** be read as saying all of these bundle contracts already exist
as frozen authored schemas.

## The Short Version

If you only remember one picture, remember this:

```text
Wesley compiles.
Holmes investigates.
Watson verifies the evidence chain.
Moriarty judges and predicts.
BLADE certifies release readiness.
The project deploys.
```
