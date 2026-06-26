---
title: Wesley Graft MCP Boundary
legend: RUNTIME
packet: 0010-wesley-graft-mcp-boundary
status: design
release: future
---

# Wesley Graft MCP Boundary

## Sponsors

- Human: I can let an agent inspect and propose changes through one local MCP
  surface without letting it invent schema meaning, browse outside its aperture,
  or touch undeclared coordinates.
- Agent: I can ask for schema truth, footprint truth, and repository aperture
  truth before I act, then explain exactly why a proposed operation is
  admissible or rejected.

## Hill

An agent connected to a Wesley+Graft MCP server can construct an admissible
operation proposal: Wesley proves the GraphQL operation structure and whether
its declared footprint matches its actual schema-coordinate selections; Graft
proves what repository context the agent is allowed to see and touch; the MCP
coordinator admits only the intersection of those two claims.

## Boundary Rule

The MCP server is a coordination surface, not a new source of truth.

```text
Wesley owns schema meaning and footprint honesty.
Graft owns repository aperture and context policy.
MCP owns tool transport and admission choreography.
Agents own proposals, never authority.
```

That split keeps the product goal sharp. The server can help an agent build a
admissible operation proposal, but it cannot make an illegal operation legal by
presentation.

## Why This Exists

The Rust-native `wesley` binary now has a real footprint checker. That is the
cold CLI form of the invariant:

```text
declared @wes_footprint == actual selection set
```

The MCP product goal is the agentic form of the same invariant. An agent should
not merely ask for files and then improvise. It should ask:

1. What does the schema say?
2. What does this operation actually touch?
3. What does the policy aperture allow me to inspect or modify?
4. Is the proposed operation inside both the declared GraphQL footprint and the
   allowed repository aperture?

If any answer fails, the server should return a refusal before world state is
touched.

## Roles

### Wesley

Wesley provides compiler facts.

It should answer:

- what types, fields, directives, roots, enum values, interfaces, unions, and
  input objects exist in the schema
- which schema coordinates an operation selection set actually references
- which reads and writes the operation declared in `@wes_footprint`
- which actual selections are undeclared
- which declarations are unused
- which canonical schema or IR hash backs the answer

Wesley must not answer:

- which files an agent is allowed to read
- which repository paths implement a type or field
- whether a policy exception should be granted
- whether a code edit should be applied

### Graft

Graft provides aperture facts.

It should answer:

- which paths, symbols, modules, or evidence records are visible to this agent
- which paths or symbols are writable
- which requested context is outside the aperture
- which policy rule granted or denied each aperture edge
- which repository snapshot or policy hash backs the answer

Graft must not answer:

- whether a GraphQL operation's footprint declaration is honest
- what the authoritative schema means
- whether a schema coordinate exists
- whether an undeclared GraphQL touch should be forgiven

### MCP Coordinator

The MCP coordinator binds Wesley and Graft without absorbing either one.

It should:

- expose small, typed tools
- call Wesley for schema and footprint facts
- call Graft for aperture facts
- intersect the two fact sets into an admission verdict
- return machine-readable evidence for every verdict

It must not:

- lower schemas itself
- parse repository policy itself
- keep shadow copies of schema or aperture truth
- execute writes that were not admitted
- silently widen an aperture to satisfy an operation

## Tool Surface Sketch

Names are design placeholders, not implementation commitments.

### `wesley.schema.describe`

Input:

```json
{
  "schema": "SDL text or repository reference"
}
```

Output:

```json
{
  "irVersion": "1.0.0",
  "schemaHash": "sha256:...",
  "types": [
    {
      "name": "Receipt",
      "kind": "OBJECT",
      "fields": ["id", "status"]
    }
  ]
}
```

The server may summarize for humans, but the machine output must stay anchored
to the Rust L1 IR.

### `wesley.footprint.check`

Input:

```json
{
  "schema": "SDL text or repository reference",
  "operation": "GraphQL operation text"
}
```

Output:

```json
{
  "declaredReads": ["Receipt.status"],
  "declaredWrites": ["Mutation.admitChange"],
  "actualSelections": ["Mutation.admitChange", "Receipt.status"],
  "undeclaredSelections": [],
  "unusedDeclarations": [],
  "verdict": "honest"
}
```

The extraction/checking behavior should come from `wesley-core`, not from MCP
server-side string inspection.

### `graft.aperture.describe`

Input:

```json
{
  "intent": "inspect or modify the code backing Receipt.status",
  "requestedCoordinates": ["Receipt.status"],
  "requestedPaths": ["crates/wesley-core/src/domain/ir.rs"]
}
```

Output:

```json
{
  "visible": ["crates/wesley-core/src/domain/ir.rs"],
  "writable": [],
  "denied": [],
  "policyHash": "sha256:..."
}
```

The concrete Graft API can differ. Wesley's requirement is that aperture
answers are explicit, inspectable, and not inferred from agent preference.

### `operation.admit`

Input:

```json
{
  "schema": "SDL text or repository reference",
  "operation": "GraphQL operation text",
  "requestedPaths": ["crates/wesley-core/src/domain/ir.rs"]
}
```

Output:

```json
{
  "verdict": "admitted",
  "schemaHash": "sha256:...",
  "policyHash": "sha256:...",
  "declaredFootprint": ["Receipt.status", "Mutation.admitChange"],
  "actualFootprint": ["Receipt.status", "Mutation.admitChange"],
  "visiblePaths": ["crates/wesley-core/src/domain/ir.rs"],
  "writablePaths": []
}
```

`operation.admit` is the composition point. It is allowed to call Wesley and
Graft; it is not allowed to replace either.

## Admission Flow

1. Receive an agent proposal.
2. Resolve or read the authored schema.
3. Ask Wesley for L1 schema meaning and operation footprint facts.
4. Ask Graft for the policy-bounded repository aperture.
5. Reject if the footprint is dishonest.
6. Reject if any requested read/write falls outside the Graft aperture.
7. Return an admission verdict with schema hash, footprint facts, policy hash,
   and aperture facts.
8. Only admitted proposals may proceed to any write-capable tool.

This is deliberately stricter than "the agent seems to know what it is doing."
The server should make honest failure cheap.

## Refusal Cases

The coordinator should refuse when:

- the schema fails to parse or lower
- the operation fails to parse
- the operation has multiple executable definitions without an explicit
  selected operation
- `@wes_footprint` omits an actual schema-coordinate selection
- `@wes_footprint` declares unused coordinates and strict mode is enabled
- a selected schema coordinate does not exist
- a requested path, symbol, or repository context edge is outside the Graft
  aperture
- Wesley and Graft evidence hashes cannot be attached to the verdict

Refusals should be data, not prose-only diagnostics.

## Evidence Shape

Every admitted operation proposal should carry:

- Wesley core version
- MCP server version
- schema source identity
- schema or IR hash
- operation hash
- declared footprint
- actual footprint
- honesty verdict
- Graft policy identity
- Graft policy or aperture hash
- visible path set
- writable path set
- refusal reasons, if any

Those fields make the MCP server useful to both humans and downstream runtime
admission guards.

## Security Posture

The initial server should be local-first.

- Do not add network fetches to resolve schemas or policy by default.
- Do not load untrusted module code as part of footprint checking.
- Do not grant write tools until `operation.admit` returns an admitted verdict.
- Do not let prompts override policy.
- Do not store hidden state that changes admission outcomes without appearing
  in the evidence.

The point is not to make the agent powerful. The point is to make power bounded
and inspectable.

## Implementation Sequence

1. Stabilize the Rust extraction/checking API and CLI JSON output.
2. Add a small Rust MCP crate or binary that wraps existing `wesley-core`
   functions without adding new compiler logic.
3. Define a Graft adapter trait in the MCP layer, not in `wesley-core`.
4. Implement a read-only `wesley.schema.describe` and `wesley.footprint.check`
   server.
5. Add Graft aperture calls and `operation.admit`.
6. Add write-capable tools only after admission evidence is mandatory.
7. Add integration fixtures that prove dishonest footprints and denied paths
   are refused before any write tool can run.

## Non-Goals

- Do not implement the MCP server in this packet.
- Do not add Node, npm, or TypeScript as the MCP entry point.
- Do not add Graft as a dependency of `wesley-core`.
- Do not add Echo runtime admission in this slice.
- Do not create a target projection crate just to have a place for future work.

## Open Questions

- What is the minimal Graft aperture response shape Wesley should require?
- Should unused declarations be warnings by default and errors in strict mode,
  or always errors for MCP admission?
- How should schema sources be referenced when the schema itself is inside a
  Graft aperture?
- Should `operation.admit` return a reusable capability token, or should every
  write call re-check admission evidence?
- How much of the MCP protocol should live in a standalone `wesley-mcp` crate
  versus a binary under `crates/wesley-cli`?

## Retro

This packet closes the five-move cut without pretending the MCP server exists
yet.

What landed:

- schema-aware footprint checking in Rust
- schema-coordinate extraction through the native CLI
- broader L1 lowering for GraphQL scalar, interface, union, enum, and input
  object families
- a Rust-native CI lane
- a native install/release path that does not require npm
- this MCP boundary packet

What changed:

- `wesley-core` is now a more credible library boundary because schema meaning
  and footprint honesty are callable without Node.
- The native `wesley` binary is now the live core front door.
- The remaining Node surfaces are explicitly legacy/toolchain surfaces, not the
  path for new compiler truth.

What was intentionally not built:

- no MCP server
- no Graft dependency
- no Echo runtime embedding
- no WASM ABI work
- no npm entry point for the Rust binary

Risks:

- The footprint checker still needs stricter operation selection handling for
  multi-operation documents.
- The Graft aperture contract is conceptual here; the first implementation
  must bind it to real Graft evidence instead of local convention.
- The native CLI currently has one useful command. The front door is correct,
  but still narrow.

Next slice:

Build the smallest read-only Rust MCP prototype around `wesley-core` after the
CLI JSON output is stable enough to reuse as an integration oracle.
