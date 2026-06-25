# Wesley North Star

<!-- docs-truth: status=experimental owner=@flyingrobots -->

Wesley's north star is narrow:

```text
GraphQL SDL -> deterministic Wesley IR -> external owners give it meaning
```

Wesley extracts the structure described by GraphQL, preserves source-level
facts that downstream extensions may need, and emits deterministic evidence
that can be hashed, diffed, validated, and consumed by other tools.

Wesley does not own the domain built on top of that structure.

## Domain-Free Invariant

Wesley owns:

- GraphQL SDL parsing and normalization.
- L1 IR lowering.
- Structural hashes and schema deltas.
- Root operation catalogs and operation selection facts.
- Preserved directive data.
- Domain-empty Rust and TypeScript projections.
- Shared codec planning for Wesley-owned emitted artifacts.
- `weslaw` authoring, Law IR, coverage, and report-only capability summaries.
- Generic operation artifacts that describe operation shape, requirements, and
  law claims without executing anything.

Wesley does not own:

- Echo graph rewrites, scheduling, observation, or footprint enforcement.
- Continuum participant protocol, admission, or witness semantics.
- PostgreSQL/Supabase schemas, migrations, policies, or execution adapters.
- Geordi renderers, frontend adapters, websites, or playgrounds.
- Runtime authority, capability grants, tickets, handles, or admission policy.
- Product-specific law interpretation.

If a feature requires Wesley to decide what a target's runtime meaning is, it
belongs in that target's repo or extension.

## Operation Artifacts

Operation artifacts are the current generic boundary for a selected GraphQL
operation. They are compiler artifacts, not runtime permissions.

An operation artifact may contain:

- schema identity;
- operation identity;
- root argument bindings;
- selected payload shape;
- preserved executable directives;
- declared footprint data, when authored;
- compiler-produced law claim templates;
- canonical requirements bytes and digest;
- a registration descriptor an external target can compare before import.

Wesley can prove that it produced these bytes deterministically from GraphQL
structure. It does not prove that a runtime admitted the operation, executed it,
or satisfied target-owned law.

## Claim IDs

Compiler-owned operation-artifact claims use explicit operation-scoped names:

| Claim                           | Meaning                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `operation.shape.valid.v1`      | The selected operation is valid inside Wesley's declared executable subset.       |
| `operation.codec.canonical.v1`  | Wesley generated canonical codec evidence for the operation shapes.               |
| `operation.footprint.closed.v1` | A target verifier may need runtime trace evidence for declared footprint closure. |

External targets may add their own law IDs through preserved directives. Those
IDs are not Wesley-owned semantics.

## Extension Rule

Extensions can use Wesley facts to build richer systems. That is the point.

The extension boundary is still absolute:

```text
Wesley produces structure and evidence.
Extensions assign meaning and execute policy.
```

This keeps Wesley useful for many consumers without smuggling one consumer's
ontology back into the core compiler.
