# Workflow YAML Assertion Helper

- Lane: `cool-ideas`
- Legend: `RUNTIME`

## Why now

The repo's workflow bats coverage is valuable, but some checks still rely on
grep windows and line-oriented shell snippets that are more brittle than the
workflow contracts they are trying to protect. The PR #467 review pass improved
that locally, but the pattern is still ad hoc.

## Hill

A maintainer can express workflow-policy assertions through one small helper
surface that targets jobs, steps, permissions, and script snippets without
relying on fragile text windows or emoji-labeled boundaries.

## Done looks like

- one reusable helper can extract named workflow jobs or step blocks for tests
- `test/ci-workflows.bats` asserts contract-level intent rather than incidental
  formatting
- step-name wording changes no longer break unrelated workflow checks
- the helper is deterministic and cheap enough to keep in pre-push routing
- failures explain which workflow contract drifted

## Repo Evidence

- `test/ci-workflows.bats`
- `scripts/smoke/repo-bats-prepush.sh`
- `.github/workflows/cert-shipme.yml`
- `.github/workflows/wesley-holmes.yml`
- `docs/invariants/docs-runtime-honesty.md`

## Related Carry-Over

- `#449`
- `#447`
