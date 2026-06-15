# Assurance And Capability Extraction

## Status

Supporting note for slices NR-032 through NR-044.

## Rule

The native compiler front door stays small:

```text
GraphQL SDL -> Rust compiler facts -> explicit emitters or module targets
```

Assurance, certificates, run ledgers, package evidence, and dynamic target
execution are adjacent surfaces. They can remain useful, but they must not
decide what the Wesley compiler is.

## Assurance Command Boundary

| Slice  | Surface                                                          | Decision                                                                                                                                    |
| ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| NR-032 | `cert-create`, `cert-sign`, `stake`, `cert-verify`, `cert-badge` | Extract as assurance tooling. The native Rust CLI does not grow certificate verbs during Node retirement.                                   |
| NR-033 | Holmes, Watson, Moriarty evidence commands                       | Re-home under an explicit assurance package or repo boundary. The compiler may emit facts; assurance tooling judges evidence.               |
| NR-034 | `runs` ledger inspection                                         | Exit with assurance/runtime evidence tooling. It is not needed for the compiler kernel or native emitters.                                  |
| NR-035 | package-level evidence tooling under `packages/wesley-cli`       | Delete with the Node CLI package or move beside an explicit assurance owner; it is not a product front door.                                |

The compatibility Node command bridge is closed. Retained assurance behavior now
lives under `@wesley/holmes` or the Rust Holmes foundation, while new Rust
compiler features must not depend on historical Node commands.

The Holmes/Watson/Moriarty exit path is now design packet
[`0018-holmes-assurance-hexagon`](../0018-holmes-assurance-hexagon/holmes-assurance-hexagon.md).
That packet defines Holmes as a Rust-native assurance hexagon with CLI, API,
MCP, and reporting adapters instead of a direct port of the legacy Node package.

## Dynamic Module Loading Replacement

NR-036 rejects a direct port of Node dynamic module loading. The replacement
shape is a Rust-native target registry plus a future external-process or WASM
capability protocol:

- Rust code records target metadata before dispatch.
- Target names are unique.
- A single default target must be explicit.
- Capabilities declare execution mode and portability floor.
- Host powers are requested and reported before execution.
- WASM capabilities run under deny-by-default host-function policy.

The first executable proof lives in
`crates/wesley-core/src/domain/capability.rs` and
`crates/wesley-core/tests/module_capability_registry.rs`.

## Rust Capability Fixtures

| Slice  | Fixture proof                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NR-037 | `ModuleTargetRegistry` covers no-module, default target, explicit target, and duplicate target behavior.                                                   |
| NR-038 | `ModuleTargetDescriptor` records `executionMode` and `portabilityFloor`.                                                                                   |
| NR-039 | `capability_report()` names requested, granted, and denied target capabilities.                                                                            |
| NR-040 | `HostFunctionPolicy::pure()` denies all WASM host imports by default.                                                                                      |
| NR-041 | `reject_unavailable_imports_before_execution()` rejects a WASM target that requests unavailable imports before any execution hook exists.                  |
| NR-042 | `HostCapabilityContract` reports incompatible capability ABI ranges with typed diagnostics before execution.                                               |
| NR-043 | `RuntimeResourcePolicy::stateless_default()` defines the default stateless runtime and rejects future resource handles unless a future policy allows them. |
| NR-044 | `HermeticCapabilityFixture` verifies that Rust-native, WASM, and external-process fixture outputs match for one canonical input digest.                    |

This is not a full module runtime. It is the first Rust-side control surface
that prevents Node loader behavior from becoming the template for the native
runtime.
