# publication-boundary-truth

## Invariant statement

For every admitted shared contract family Wesley carries, one authored home,
one or more generated contract legs, and any compat or inspect mirrors must be
named explicitly. Those surfaces may have different authority classes, but they
must not quietly become peer authorities to one another.

## Preserved when

- each admitted family names one authored schema home directly
- generated consumer legs, compat mirrors, inspect-only outputs, and mocked
  surfaces carry an explicit authority status instead of being inferred from
  path shape or repo habit
- docs and command output distinguish authored home, generated contract,
  compat-only mirror, and inspect/mock surface clearly
- anti-shadow checks fail when handwritten files start impersonating the
  authored home or a reserved generated leg

## Violated when

- a maintainer has to guess which file actually owns a shared noun family
- generated outputs, vendored copies, or compat mirrors are treated as if they
  were authored source
- mocked or inspect-only surfaces are presented as live runtime truth
- a handwritten shadow contract survives beside an admitted family with no
  explicit retirement or authority downgrade

## How to check

- inspect architecture docs, schema locations, and generated output trees for a
  directly named authored home and explicit authority classes
- challenge any new file that looks like a contract surface but is not marked
  as authored, generated, compat-only, or inspect/mock
- prefer machine-checkable anti-shadow rules over prose-only publication
  boundaries
