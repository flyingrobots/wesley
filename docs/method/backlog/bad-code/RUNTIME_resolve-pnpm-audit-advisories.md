# Resolve pnpm audit advisories before release

- Lane: `bad-code`
- Legend: `RUNTIME`

## Why now

`pnpm audit --json` currently reports dependency vulnerabilities that should not
be carried into a production/client release. The highest-risk item is
`picomatch@4.0.3` ReDoS, with additional moderate findings in `postcss` and
`brace-expansion`.

## Hill

The release branch has a clean or explicitly triaged dependency-audit posture.

## Done looks like

- `picomatch` is updated or overridden to a patched version such as `>=4.0.4`
- `postcss` is updated or overridden to a patched version such as `>=8.5.10`
- vulnerable `brace-expansion` paths are updated, overridden, or documented with
  parent-package constraints
- `pnpm audit --json` is clean or every remaining finding has a written exposure
  analysis
- `pnpm run preflight` and targeted glob/docs/website tests pass after lockfile
  updates

## Repo Evidence

- `package.json`
- `pnpm-lock.yaml`
- `pnpm audit --json`
