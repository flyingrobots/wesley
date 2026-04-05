# provenance-visibility

## Invariant statement

Operators and agents must be able to see where a meaningful claim came from:
which run, which inputs, which artifacts, which facts, or which judgment path
produced it.

## Preserved when

- reports, JSON surfaces, and certs expose run IDs, digests, refs, artifact
  pointers, or equivalent provenance hooks
- humans and agents can challenge a judgment without reverse-engineering the
  entire repo state from scratch
- provenance remains visible across runtime, evidence, and certification
  surfaces

## Violated when

- a verdict appears with no inspectable path back to inputs or facts
- operator surfaces collapse multiple judgments into an opaque status light
- docs or reports force users to trust internal synthesis they cannot trace

## How to check

- inspect reports, JSON output, certs, and docs for run IDs, fact digests,
  artifact pointers, provenance hashes, or equivalent references
- verify that failure and readiness surfaces expose enough context to reproduce
  or challenge the claim
