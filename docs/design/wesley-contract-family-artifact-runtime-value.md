# Contract Families, Compiled Artifacts, And Runtime Values
<!-- docs-truth: status=current owner=@flyingrobots -->

This note freezes one boundary that Wesley must keep sharp:

- contract families
- compiled artifacts
- runtime values

These are related, but they are not the same thing.

## Hard Rules

1. **GraphQL is the authored language.**
2. **Directives are the extension mechanism.**
3. **Wesley compiles authored GraphQL into artifacts.**
4. **Wesley does not emit runtime values.**
5. **Tools and runtimes later emit values that conform to authored GraphQL families.**

## Contract Family

A contract family is a bounded, authored GraphQL family that is versioned,
compiled, witnessed, and released as one unit.

Examples:

- `BillingEvent`
- `InventoryMutation`
- `ObserverSpec`
- `RuntimeResult`
- `ImportOutcome`

A contract family is authored truth. It defines what shape is being named and
what the stack agrees exists at the contract boundary.

## Compiled Artifact

A compiled artifact is something Wesley emits from authored GraphQL.

Examples:

- TypeScript files
- Rust files
- externally supplied SQL or migration legs
- generated tests
- manifests and mappings
- registries and codec outputs

Compiled artifacts are derived truth. They are inspectable and useful, but they
do not replace the authored family that governs them.

## Runtime Value

A runtime value is an actual value later produced by a runtime or tool that
uses Wesley outputs.

Examples:

- an actual product runtime value emitted after admission
- an actual database result value emitted by a database host
- an actual report value emitted by Holmes, Watson, Moriarty, or BLADE

Runtime values are execution-time truth. Wesley may compile code and contracts
that define their shape, but Wesley itself does not emit them.

## The Boundary In One Line

The clean pipeline is:

```text
GraphQL contract family -> Wesley compiled artifacts -> later runtime/tool values
```

That boundary must remain visible in both docs and code.

## Product-Specific Consequence

Observer-anything remains product-module-only.

That does **not** mean observer nouns are mystical or outside GraphQL.

It means:

- observer contracts are authored GraphQL families in the owning product repo
- Wesley can compile artifacts for those families through a loaded external
  module
- product runtimes and tools later produce actual values that conform to those
  families

## Why This Note Exists

If we collapse these three layers, we get the same old confusion:

- authored contracts mistaken for runtime instances
- generated files mistaken for governing truth
- runtime values described as if Wesley itself produced them

That is exactly the mush this stack is trying to avoid.
