# Invariants

Invariants are the canonical properties that Wesley must preserve across
application cycles. They are stable product truths, not temporary roadmap
contracts, and not personal taste.

Wesley's current application invariants are:

- [schema-source-of-truth](./schema-source-of-truth.md)
- [ledger-truth](./ledger-truth.md)
- [evidence-truth](./evidence-truth.md)
- [provenance-visibility](./provenance-visibility.md)
- [local-first-operation](./local-first-operation.md)
- [governance-boundaries](./governance-boundaries.md)
- [docs-runtime-honesty](./docs-runtime-honesty.md)

This is the exact set. If a future cycle needs a new invariant, it should add
one explicitly rather than quietly smuggling it into prose elsewhere.

Each invariant file answers four questions:

1. What is the invariant statement?
2. What preserves it?
3. What violates it?
4. How do you check it?

Phase-specific contracts such as `transform` naming, package transitions, or
milestone gates still live in [ROADMAP.md](../../ROADMAP.md). Those matter, but
they are not the same thing as application invariants.

Core product pillars also live elsewhere. For example, Wesley's
multi-transmutation ambition is a pillar of product direction, but it is not the
same claim as `schema-source-of-truth`.
