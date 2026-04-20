# Advanced Guide — Wesley

This is the second-track manual for Wesley. Use it when you need the deeper doctrine behind the platform-neutral IR, custom GraphQL directives, and the "Holmes" policy engine.

For orientation and the productive-fast path, use the [GUIDE.md](./GUIDE.md).

## Intermediate Representation (IR)

Wesley uses a platform-neutral IR to decouple the authored schema from the generated artifacts. This IR is the "Canonical Meaning" of the contract.

- **Normalization**: SDL is lowered into a strictly-typed IR tree (see `schemas/ir.schema.json`).
- **Optimization**: The pipeline performs constant folding and type-pruning on the IR before generator emission.
- **Portability**: All generators consume the same IR, ensuring that a "Coordinate" or "Receipt" has bit-identical representation in both Rust and TypeScript.

## Custom Directives

Wesley extends GraphQL SDL with custom directives to capture systems-level intent. These are the "Instruction Manual" for the compiler.

- **`@wesley(id: "...")`**: Registers a type or field in the global registry.
- **`@storage(backend: "postgres")`**: Maps a schema entity to a physical database table.
- **`@policy(rule: "no-breaking")`**: Injects a HOLMES invariant check into the transmutation pipeline.

See [DIRECTIVES.md](./DIRECTIVES.md) for the full truth table.

## HOLMES: Automated Governance

HOLMES is the automated policy engine that guards Wesley's "Trustworthy Change" claim.

### Certification Pipeline
1. **Plan**: Compare the new schema against the current-state IR.
2. **Rehearse**: Simulate the transformation against mock targets.
3. **Verify**: Run property-based tests to ensure idempotence and safety.
4. **Witness**: Issue a machine-readable certificate of conformance.

## Performance & Scaling

Wesley uses a content-addressed cache (`.wesley-cache/`) to avoid redundant transmutation work. For giant monorepos, the `witness` suite supports scoped proving (e.g., `receipt-family`) to keep the CI loop fast.

---
**The goal is inevitably. Every continuation from the past is explicit, capability-gated, and provenance-bearing.**
