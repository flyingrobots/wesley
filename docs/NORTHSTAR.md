# Wesley North Star
<!-- docs-truth: status=experimental owner=@flyingrobots -->

Wesley's ultimate north star is **bounded, lawful autonomy**.

The current repo proves early compiler facts: GraphQL SDL lowering, operation
catalogs, Rust and TypeScript projection, preserved directive data, and
fixture-backed operation bindings. The long-term direction is larger:

```text
agent or application declares the optic it needs
  -> Wesley compiles the GraphQL contract
  -> host policy checks authority, support, and budget
  -> a runtime such as Echo admits, obstructs, schedules, and witnesses it
  -> the caller receives a lawful reading or receipt
```

Wesley should feel like an empowerment tool for agents. It should let an agent
propose a precise, typed, inspectable interaction surface instead of scraping
text, guessing state shape, or asking for broad ambient access.

## The Difference From MCP

MCP gets important transport machinery right: tool discovery, typed inputs,
structured outputs, and a common service boundary for agents.

The missing layer is the language for declaring the reading or rewrite the
agent actually wants.

MCP usually says:

```text
Here are the tools this service offers.
Choose one.
```

Wesley should let a governable service say:

```text
Here is the lawful surface of this system.
Declare the bounded reading or rewrite you need.
```

GraphQL is the difference. A GraphQL operation is not just a request payload; it
is a declarative optic shape:

- selected fields define the desired reading
- variables define the bounded input
- directives attach law-shaped metadata
- operation names give identity
- schema coordinates make the request statically inspectable
- result types make the reading shape explicit

The transport can still look MCP-like. The interaction language is GraphQL.
Wesley compiles that interaction language into a runtime optic artifact.

## Programmable GraphQL APIs, But Lawful

The target is not a wild-west programmable API. It is programmable GraphQL under
law.

Traditional GraphQL:

```text
client writes query
server owns schema and resolvers
server executes against app state
response comes back
```

Wesley runtime optics:

```text
agent writes or selects a GraphQL operation
Wesley compiles it into an optic contract
host policy checks authority, support, and budget
runtime admits or obstructs the operation
reading or receipt comes back with witness posture
```

The operation is empowering because it is bounded. It names the basis,
aperture, footprint, variables, result shape, and law hooks that make autonomy
inspectable.

## Legal WARP Optics

A legal WARP optic is a bounded GraphQL-declared interaction with explicit law.

It can be a reading:

```graphql
query ReadCodeSlice($path: String!) {
  file(path: $path)
    @wes_law(id: "bounded.read.v1")
    @wes_aperture(kind: "symbol_context", maxBytes: 12000) {
    path
    digest
    outline {
      kind
      name
      range
    }
  }
}
```

Or it can be a rewrite:

```graphql
mutation RenameSymbol($input: RenameSymbolInput!) {
  renameSymbol(input: $input)
    @wes_law(id: "bounded.rewrite.v1")
    @wes_footprint(
      reads: ["workspace.files", "symbol.index"]
      writes: ["workspace.files"]
      forbids: ["secrets", "git.refs"]
    ) {
    receipt {
      basisRef
      resultRef
      operationId
      witnessDigest
    }
  }
}
```

Wesley should compile the operation, preserve the law declarations, generate
the canonical variable and payload codecs, and produce the law-claim artifact.
It should not grant authority or execute the world.

## How A System Becomes Governable

A system becomes governable by publishing a GraphQL contract over governable
capabilities and routing access through instrumented optic handlers.

That means the system exposes:

- resource families
- operation and reading fields
- input and payload types
- footprint labels
- aperture kinds
- law directive vocabulary
- witness result types
- support and budget hooks

Then every read or rewrite goes through a handler that can report what happened:

- declared footprint
- actual reads
- actual writes
- support consumed
- budget spent
- basis used
- payload emitted
- obstruction reason when law is not met

This is the missing step between "law was declared" and "law was satisfied."
Wesley compiles the claim. The service runtime and its verifier produce the
law-satisfaction witness.

## Law Satisfaction

The system needs a way to say:

```text
Given law L, basis B, support S, authority A, and evidence E:
L is satisfied, obstructed, or unknown.
```

That verdict must be an evidence-bearing artifact, not a bare boolean.

At target state, a law witness should carry:

- law id
- claim id
- basis reference
- checker identity
- checker artifact hash
- verdict
- evidence digests
- runtime trace digest when available
- obstruction reason when not satisfied
- replay hints when available

Different law classes have different proof strength:

| Law class | Likely verifier |
| --- | --- |
| Structural shape | Wesley compiler |
| Canonical codec | Wesley generated codec plus fixture vectors |
| Runtime footprint | Echo or another instrumented runtime |
| Capability and authority | Host policy |
| Domain semantics | Application-owned checker |
| Human intent | Review, attestation, or unknown posture |

Honesty matters. Wesley should distinguish declaration, satisfaction,
obstruction, and unknown posture instead of flattening everything into "valid."

## Echo Boundary

Echo should not learn application nouns.

Applications can talk in their own generated language:

- Think can talk about captures and derivation artifacts.
- Graft can talk about structural projections and review readings.
- jedit can talk about buffers and ranges.

At Echo's boundary, those nouns should erase into causal runtime facts:

- contract artifact id
- operation id
- basis reference
- canonical variable bytes
- canonical variable digest
- declared footprint
- support references
- payload codec
- reading identity
- receipt and witness material

That is why Wesley exists. It lets applications keep their shape while Echo
receives only canonical buffers, identities, footprints, receipts, witnesses,
and readings.

## Target Admission Flow

The runtime handoff should stay explicit:

```text
application declares GraphQL operation
  -> Wesley compiles OpticArtifact
  -> Wesley returns OpticArtifact plus artifact hash and requirements digest
  -> application registers artifact with Echo or another runtime registry
  -> runtime verifies Wesley artifact hash and stores requirements
  -> runtime returns opaque OpticArtifactHandle
  -> user, host, or quorum issues CapabilityGrant
  -> caller invokes with OpticArtifactHandle, canonical variables,
     capability presentation, and basis/aperture request
  -> runtime checks artifact identity, capability authority, operation
     permissions, expiry, basis validity, budget, and support requirements
  -> runtime admits or obstructs
  -> runtime instruments actual access
  -> runtime compares actual access against declared requirements
  -> runtime emits LawWitness / receipt
```

That flow preserves five separate nouns:

| Noun | Owner | Job |
| --- | --- | --- |
| `OpticArtifact` | Wesley | Compiled, content-addressed declaration of operation shape, codecs, law claims, and admission requirements. |
| `OpticRegistrationDescriptor` | Wesley | Artifact id, artifact hash, schema id, operation id, and requirements digest used when registering the artifact with a runtime. |
| `OpticArtifactHandle` | Echo or another runtime | Opaque registry handle proving the runtime accepted and stored a specific Wesley artifact hash. |
| `CapabilityGrant` / `CapabilityPresentation` | User, host, quorum, or policy authority | Bounded authority plus invocation-time proof to attempt a registered artifact under explicit constraints. |
| `LawWitness` / receipt | Echo, runtime, or verifier | Evidence describing admission, obstruction, access, basis, budget, and law satisfaction posture. |

The critical boundary is that Wesley compiles the requirements, while the
runtime registers the artifact, admits the interaction, instruments access, and
witnesses what happened. A runtime handle proves registration, not authority.

## What Wesley Must Become

The target architecture is layered:

1. **Static compiler**: lower SDL, list operations, diff schema structure, and
   emit Rust or TypeScript artifacts.
2. **Contract artifact compiler**: produce operation ids, schema/artifact
   identity, canonical variable codecs, payload codecs, and footprint
   certificates.
3. **Runtime library**: compile runtime-provided SDL fragments into in-memory
   contract artifacts without requiring file generation.
4. **Optic plan compiler**: produce read, rewrite, observation, codec,
   footprint, support, and witness plans.
5. **Law claim compiler**: bind operations to law declarations, verifier
   requirements, and witness codecs.
6. **Admission handoff**: hand the compiled artifact to Echo, host policy, or
   another runtime for actual admission, scheduling, obstruction, and witness.

Wesley does not become the runtime. It gives runtimes a lawful artifact they can
admit, obstruct, schedule, witness, and replay.

## First Concrete Hill

The first implementation hill is:

> Wesley compiles GraphQL operations into lawful optic contracts: typed,
> bounded, inspectable declarations of reads and rewrites that runtimes can
> govern and witness.

The first witness does not need Echo. It can be a Rust test proving:

- runtime SDL parses and lowers
- the selected operation resolves
- root field argument bindings are validated and preserved
- input object literals, nested required input fields, and enum values are
  schema-validated before `shape.valid.v1` is claimed
- nested list wrappers are preserved during literal validation, so list depth
  and nullability are part of the validity claim
- nested list variable bindings preserve non-null leaf requirements
- composite fields require subselections, and leaf fields reject subselections,
  before payload shape metadata is trusted
- same-response-name field selections must be merge-compatible before payload
  codec extraction can collapse duplicate response paths
- fragment spreads and inline fragments have compatible type conditions before
  they contribute payload, directive, or argument metadata
- directive law data is preserved across the operation and selected field tree,
  including executable variable references
- operation identity is stable
- variable and response payload codec shapes are typed, aliased, and nullable
  path-aware
- declared read and rewrite footprints are preserved
- a `footprint.closed.v1` law claim template is produced for runtime
  governance and witness

The repo-visible v0 surface for that hill is `compile_runtime_optic()`. It
returns an in-memory `OpticArtifact` containing schema identity, artifact
identity, artifact hash, operation identity, operation kind, operation name,
canonical root argument bindings, canonical selected field argument bindings,
variable codec shape, response payload codec shape, preserved directive records
from the executable operation and selected field tree, declared footprint, law
claim templates, admission requirements, requirements digest, and an
`OpticRegistrationDescriptor`.
`compile_runtime_optic_registration()` returns just the registration descriptor
for callers that need the cross-process registration reference without
receiving the full in-memory artifact object.

The registration descriptor carries artifact id, artifact hash, schema id,
operation id, and requirements digest. It is not an authority grant and it is not
the Echo-owned `OpticArtifactHandle`. Echo or another runtime returns the opaque
handle after it accepts the artifact and stores the requirements. Wesley
deliberately does not execute the operation, issue capabilities, call Echo, run a
policy engine, or verify runtime law satisfaction.

The first resolver hill is equally small: an `OpticArtifactResolver` can resolve
an `OpticRegistrationDescriptor` back to its `OpticArtifact` and reject
descriptors whose artifact id, artifact hash, schema id, operation id, or
requirements digest no longer match. The v0 proof is an in-memory registry, not
distributed infrastructure. The in-memory registry normalizes registration
descriptors from stored artifact identity fields at insertion so stale embedded
descriptor data cannot become the returned resolver reference.

The next witness can let an Echo fixture verifier say:

```text
law footprint.closed.v1 was satisfied
```

or:

```text
law footprint.closed.v1 was obstructed because the runtime touched an
undeclared read
```

That is the first real proof of bounded, lawful autonomy.

## Doctrine

Wesley compiles lawful optic claims. Echo or another runtime registers, admits,
obstructs, instruments, and witnesses them. Applications hold product-facing
capabilities that hide artifact handles, basis references, and runtime
coordinates.

Agents do not get ambient authority. They get a lawful way to propose precise
readings and rewrites, and an evidence-bearing way to learn why a proposal was
admitted, obstructed, or left unknown.

That is the OS-level promise: agents can interact with anything governable, not
because every tool was prebuilt, but because the system can accept a bounded
GraphQL optic and prove what happened.
