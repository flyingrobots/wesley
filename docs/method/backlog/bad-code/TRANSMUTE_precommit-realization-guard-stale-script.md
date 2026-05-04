# TRANSMUTE pre-commit realization guard stale script

Package manifest changes still trigger `.githooks/pre-commit`, and that hook
still runs `pnpm run -s verify:realization`. The root `verify:realization`
script was removed during the generic Wesley cleanup, so manifest-only commits
can fail the hook after lockfile, forbidden-literal, lint, targeted tests, and
preflight validation have already passed.

Done when:
- `.githooks/pre-commit` no longer calls a missing root script
- any replacement guard is generic Wesley behavior rather than a resurrected
  Continuum realization verifier
- package-manifest commits can pass the hook without
  `WESLEY_SKIP_REALIZATION_GUARD=1`
