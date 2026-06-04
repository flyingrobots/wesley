# Optic Authority Vocabulary Boundary

- Lane: `bad-code`
- Legend: `SOURCE`

## Why now

Wesley now defines minimal shared structs for the artifact admission path:
`CapabilityGrant`, `CapabilityPresentation`, `AdmissionTicket`, basis and
aperture constraints, budget constraints, and observer classes. These shapes
are useful for tests and cross-repo discussion, but Wesley should not quietly
become the long-term owner of all identity and authorization vocabulary.

The boundary to keep:

- Wesley owns compiled requirements.
- Echo owns registration, admission, instrumentation, and witness emission.
- Host, user, quorum, or policy layers own authority issuance.
- Continuum may eventually own shared cross-repo authority vocabulary once more
  than one runtime/app needs it.

## Hill

The repo clearly marks which optic authority types are compiler-owned, which
are shared vocabulary placeholders, and which must eventually move or be owned
outside Wesley.

## Done looks like

- `OpticAdmissionRequirements` is documented as Wesley-owned compiler output
- `CapabilityGrant`, `CapabilityPresentation`, and `AdmissionTicket` are
  documented as shared shapes, not Wesley-issued objects
- follow-on ownership decision is recorded for Echo and Continuum
- tests avoid implying Wesley can issue runtime handles, grants, or tickets
- docs keep the phrase "handle proves registration, not authority" close to the
  relevant type definitions

## Repo Evidence

- `crates/wesley-core/src/domain/optic.rs`
- `docs/NORTHSTAR.md`
- `docs/architecture/continuum-wesley-role.md`
