# Law Capability API Version Drift

<!-- docs-truth: status=backlog owner=@flyingrobots -->

## Problem

The Holmes `weslaw` assurance PRD names law capability artifacts as
`wesley.law-capabilities/v1`, but current `wesley law capabilities --json`
output emits `wesley.capability-report/v1`.

The Rust Holmes ingest port currently accepts both names so implementation can
consume today's Wesley artifacts without blocking `HIMP-021`. That compatibility
choice should not silently become the public contract by accident.

## Why It Matters

Capability evidence is one of the required artifact families in
`HolmesLawEvidenceBundle`. Before CLI/report/publisher surfaces stabilize,
Wesley and Holmes should agree on one public artifact API version or explicitly
document the alias.

## Done When

- The Wesley producer and Holmes PRD/docs name the same stable capability
  artifact API version, or the alias is deliberately documented as supported.
- Holmes tests cover the final contract and any retained alias.
- `IMPLEMENTATION_STATUS.md`, `BEARING.md`, and the crate README no longer
  describe this as unresolved drift.
