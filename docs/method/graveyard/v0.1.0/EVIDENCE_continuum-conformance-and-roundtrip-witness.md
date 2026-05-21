---
title: Continuum Conformance And Round-Trip Witness
lane: v0.1.0
legend: EVIDENCE
release: v0.1.0
---

# Continuum Conformance And Round-Trip Witness

- Lane: `asap`
- Legend: `EVIDENCE`

## Why now

The repo now names a real TTD manifest lane and a real Echo codec lane, but
Continuum still fails if those generated surfaces are only "supposed
to match." Wesley needs a witness lane that proves canonical bytes, registry
ids, and fixture vectors stay compatible instead of relying on trust.

The repo now has a first current-state witness step through
`wesley witness-continuum`, which proves local coherence for the present TTD
and Echo minimum surfaces. The remaining work is to move that witness onto the
frozen receipt-family proving lane and real emitted family fixtures.

## Hill

Wesley can produce and verify conformance fixtures for the chosen shared
contract family so TTD manifests, Echo codecs, and downstream hot
and cold runtimes have machine-checkable compatibility proof rather than
adapter folklore.

## Done looks like

- fixture vectors are emitted from the schema-owned family
- round-trip checks verify canonical bytes or canonical structured values
  across the generated surfaces Wesley actually publishes today
- failures identify the contract family and schema hash clearly
- docs explain exactly what the witness proves and what it does not prove
- the proof lane strengthens `evidence-truth` instead of faking platform
  compatibility
- the fixture set includes a receipt-versus-witness separation case

## Witness contract

This lane should prove:

- schema-to-artifact consistency for the chosen family
- manifest and source traceability for emitted surfaces
- fixture-level conformance for selected examples
- one explicit receipt-versus-witness separation case

This lane should not claim to prove:

- runtime policy correctness
- storage semantics
- debugger semantics
- full Continuum completeness

## Repo Evidence

- historical Wesley-local TTD/Echo generator and CLI evidence was removed
  during the domain-empty extraction
- relocated Continuum-owned TTD compiler evidence now lives under
  `continuum/wesley/ttd/`
- generic Wesley's remaining evidence path should be rebuilt around module
  contracts, generated artifacts, and explicit publication boundaries
- `docs/invariants/evidence-truth.md`

## Related Carry-Over

- `#448`
- `#451`
