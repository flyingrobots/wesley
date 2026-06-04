# WARP-TTD Adapter Capability Rename

- Lane: `cool-ideas`
- Legend: `RUNTIME`

## Why now

The optic admission model now reserves `CapabilityGrant` for bounded authority:
a subject may attempt a registered artifact under explicit requirements,
constraints, and expiry. Some debugger/runtime surfaces use "capability" to mean
feature support or adapter affordance instead.

Those are different concepts:

- adapter feature support: this runtime can expose a behavior
- authority grant: this principal may lawfully attempt an invocation

Renaming feature-support capabilities before the terms spread will reduce
future confusion.

## Hill

WARP-TTD and adjacent debugger-facing docs use `AdapterCapability` or another
feature-support name where no authority grant is involved.

## Done looks like

- inventory current WARP-TTD "capability" usage
- rename feature-support values to `AdapterCapability` or a better local noun
- leave actual authority vocabulary aligned with `CapabilityGrant`
- docs explain the difference between adapter affordance and authority grant
- no runtime behavior changes unless required by the rename

## Repo Evidence

- `crates/wesley-core/src/domain/optic.rs`
- WARP-TTD repo docs and adapter metadata
