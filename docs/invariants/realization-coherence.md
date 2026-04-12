# realization-coherence

## Invariant statement

When Wesley realizes one authored contract family into multiple generated legs,
those legs must remain traceably tied to the same family identity and schema
hash. Multi-leg output is allowed; ontology drift between legs is not.

## Preserved when

- emitted manifests, IR, registries, codecs, generated types, and inspect
  surfaces can all identify the contract family and schema hash they realize
- generated legs agree on the family they are realizing even when they target
  different consumers or languages
- realization manifests or equivalent summaries make the current leg set
  inspectable without reverse-engineering command code
- regeneration from the same authored surface yields a coherent family rather
  than adjacent bundles with independent identity stories

## Violated when

- one generated leg silently refers to a different schema hash or family than
  the others
- neighboring repos have to guess whether two bundles are two views of one
  family or two separate authorities
- generated outputs share names while drifting in registry meaning, field
  layout, or family identity
- the repo describes multiple interpretations of one contract, but emitted
  surfaces cannot actually prove that relationship

## How to check

- inspect generated outputs for family ids, schema hashes, registry identity,
  and other cross-leg provenance hooks
- compare manifest, IR, codec, and typed surfaces for one coherent identity
  story rather than path-only correlation
- challenge any compile path that emits a new leg without extending the current
  family-level traceability surface
