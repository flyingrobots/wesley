# Continuum Cross-Repo Drift Watch

- Lane: `cool-ideas`
- Legend: `EVIDENCE`

## Why now

Wesley is getting clearer about authored homes, publication boundaries, and
stable consumer surfaces, but drift can still hide in the seams between repos.
Once a foreign-authored home, local-generated bundle, and consumer mirror all
exist, maintainers will want a cheap way to tell whether the story is still
coherent without manually diffing three repositories.

## Hill

A maintainer can run one drift-watch surface and see whether Wesley's declared
contract bundle, nearby foreign-authored homes, and known consumer mirrors are
still aligned or have started to diverge.

## Done looks like

- one witness names the contract family, authored home, schema hash, and known
  consumer surfaces being compared
- drift is reported as a contract-boundary problem, not as vague "docs out of
  date" noise
- the output distinguishes authored drift from generated-artifact drift and
  from mirror drift
- the watch can be used locally during cutovers without needing to become a CI
  requirement
- failures point at the exact seam that needs doctrine, regeneration, or
  retirement

## Repo Evidence

- `docs/architecture/continuum-wesley-role.md`
- `docs/architecture/continuum-minimum-shared-contract-surface.md`
- `docs/invariants/schema-source-of-truth.md`
- `docs/invariants/evidence-truth.md`
- `docs/method/backlog/up-next/SOURCE_WESLEY_protocol-surface-cutover.md`

## Related Carry-Over

- `#365`
- `#456`
