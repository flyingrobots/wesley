# Optic Wire Serialization Snapshots

- Lane: `bad-code`
- Legend: `EVIDENCE`

## Why now

Wesley now defines wire-facing structs for the runtime optic path:
`OpticRegistrationDescriptor`, `OpticArtifactHandle`, `CapabilityGrant`,
`CapabilityPresentation`, `AdmissionTicket`, and `LawWitness`. Some of these
are not issued by Wesley, but the shared shape matters because Echo, app
adapters, and future witnesses will rely on stable serialized field names.

Enums with acronyms and digits, especially `ObserverClass::Oc0` through
`ObserverClass::Oc3`, deserve one boring snapshot. It is cheaper to lock the
wire spelling now than to debug a later cross-process mismatch.

## Hill

Wesley has tiny serialization snapshot tests for optic registration, authority,
admission, and witness-facing structs.

## Done looks like

- snapshot covers `OpticRegistrationDescriptor`
- snapshot covers `OpticArtifactHandle`
- snapshot covers `CapabilityPresentation`
- snapshot covers `AdmissionTicket`
- snapshot covers `ObserverClass::Oc0`, `Oc1`, `Oc2`, and `Oc3`
- snapshots assert the exact JSON field names and enum spellings
- tests make clear that Wesley defines shared shapes but does not issue Echo
  handles, capability grants, or admission tickets

## Repo Evidence

- `crates/wesley-core/src/domain/optic.rs`
- `crates/wesley-core/tests/runtime_optic_artifact.rs`
