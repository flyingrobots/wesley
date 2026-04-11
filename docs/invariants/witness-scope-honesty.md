# witness-scope-honesty

## Invariant statement

A Wesley witness must say exactly which contract family, which generated legs,
and which properties it proves, while naming what remains out of scope. A
family witness is allowed to be narrow, but it is not allowed to sound wider
than it is.

## Preserved when

- witness outputs name the contract family, authored inputs, generated legs,
  and proof scope directly
- pass/fail results distinguish conformance of generated legs from runtime,
  storage, debugger, or policy semantics that remain out of scope
- mocked, inspect-only, or provisional legs are labeled as such in the witness
  story
- docs and CLI output keep current-minimum-surface proof separate from target
  receipt-family proof

## Violated when

- a witness result is read as platform compatibility proof when it only proves
  local generated-surface coherence
- reports collapse mocked inspect surfaces and live runtime facts into one
  status story
- docs imply that a passing witness covers runtime or debugger semantics it
  never measured
- failures do not say which leg or proof obligation actually broke

## How to check

- inspect witness JSON, command text, and docs for explicit `proves` and
  `doesNotProve` style boundaries
- challenge any new witness or cert output that omits family id, leg set, or
  scope caveats
- prefer witness surfaces that fail on one named leg or proof obligation rather
  than vague bundle-wide status
