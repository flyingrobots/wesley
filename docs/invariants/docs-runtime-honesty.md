# docs-runtime-honesty

## Invariant statement

Docs and status surfaces must describe what Wesley actually does today, with
status labels that make experimental, current, and proposed behavior explicit.

## Preserved when

- public docs carry `docs-truth` metadata and stay aligned with shipped
  behavior
- gaps, caveats, and phase boundaries are stated directly instead of buried
- proposed work is described as proposed, not as if it were already live

## Violated when

- docs promise behavior the runtime, tests, or fixtures cannot reproduce
- status language upgrades experimental paths into current ones without proof
- product pages hide known gaps that materially change operator expectations

## How to check

- use `docs-truth` metadata, relevant tests, and direct command or fixture
  validation whenever a doc makes a claim about shipped behavior
- challenge any doc change that cannot point to runtime evidence, tests, or
  explicit status labels
