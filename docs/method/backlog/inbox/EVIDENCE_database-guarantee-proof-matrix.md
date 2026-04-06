# Database Guarantee Proof Matrix

- Lane: `inbox`
- Legend: `EVIDENCE`

## Why now

The old README grouped several strong public guarantees together:

- comprehensive tests
- property-based proof
- round-trip validation
- idempotence checks

Some of those surfaces do exist in the repo. Some are partial. Some are only
true for narrower paths than the README implied. The repo needs one explicit
proof matrix so the broader promise can remain a goal instead of decaying into
folklore.

## Hill

Wesley can name the exact public guarantees of the current database-change lane
and map each one to concrete tests, fixtures, or witness commands, while still
showing which stronger guarantees remain target state.

## Done looks like

- one matrix lists each public guarantee and its current status:
  - proved now
  - partial / scoped
  - target state
- each `proved now` claim links to executable repo evidence
- test docs and signposts use the same guarantee language
- the broader public promise remains visible as a target instead of being lost
  when narrower present-tense wording is required

## Repo Evidence

- old `README.md` at commit `6672939`
- `test/README.md`
- `test/e2e/README.md`
- `packages/wesley-core/test/`
- `packages/wesley-cli/test/`
- `docs/VISION.md`
