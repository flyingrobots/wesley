# Advanced Guide — Wesley

This is the second-track manual for Wesley. Use it when you need the deeper
doctrine behind the platform-neutral IR, GraphQL directive preservation, and
the Holmes assurance tooling.

For orientation and the productive-fast path, use the [GUIDE.md](./GUIDE.md).

## Intermediate Representation (IR)

Wesley uses a platform-neutral IR to decouple the authored schema from the
generated artifacts. The IR is deterministic structure, not domain meaning.

- **Normalization**: SDL is lowered into a strictly-typed IR tree (see `schemas/ir.schema.json`).
- **Optimization**: The pipeline performs constant folding and type-pruning on the IR before generator emission.
- **Portability**: Generic emitters consume the same IR so generated Rust,
  TypeScript, codec, and metadata artifacts share the same source facts.

## Custom Directives

Wesley preserves GraphQL directives as inspectable structure. Generic Wesley
documents which directive families are current, experimental, external,
deferred, or historical; it does not claim domain semantics for every directive
name that can appear in SDL.

- **Current compiler directives**: Use canonical `@wes_*` names for current
  generic compiler examples.
- **External directive families**: Database, runtime, protocol, graph rewrite,
  and application directives belong to their owning module or consuming app.
- **Aliases**: Legacy aliases are compatibility affordances only where the
  current parser explicitly accepts them.

See [reference/directives.md](./reference/directives.md) for the full truth table.

## HOLMES: Automated Governance

HOLMES is the automated policy engine that guards Wesley's "Trustworthy Change" claim.

### Certification Pipeline

1. **Transform**: Lower the authored schema and execute loaded transmutations.
2. **Verify**: Run module-owned or generic evidence checks.
3. **Witness**: Issue a machine-readable certificate of conformance.

## Performance & Scaling

Wesley uses a content-addressed cache (`.wesley-cache/`) to avoid redundant transmutation work. For giant monorepos, the `witness` suite supports scoped proving (e.g., `receipt-family`) to keep the CI loop fast.

---

**The goal is inevitably. Every continuation from the past is explicit, capability-gated, and provenance-bearing.**
