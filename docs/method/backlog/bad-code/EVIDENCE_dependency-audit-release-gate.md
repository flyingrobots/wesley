# Dependency audit release gate

- Lane: `bad-code`
- Legend: `EVIDENCE`

## Why now

`pnpm audit --json` is clean on the current release branch, but the audit result
is still an operator-run command rather than a visible release gate. The May 5
audits call out the gap: dependency health is good, but dependency audit is not
yet part of a documented preflight or release evidence path.

## Hill

Release readiness includes reproducible dependency-audit evidence, and high or
critical advisories cannot slip through unnoticed.

## Done looks like

- a release script or preflight-adjacent gate runs `pnpm audit --json`
- the gate parses vulnerability counts and fails on high/critical advisories
- release documentation states where dependency-audit evidence is produced
- any intentionally unresolved advisory must include package path, exposure
  analysis, temporary mitigation, owner, and expiration date
- CI/release output makes the audit result easy to attach to ship evidence

## Repo Evidence

- `package.json`
- `pnpm-lock.yaml`
- `scripts/preflight.mjs`
- `docs/method/release-runbook.md`
- `docs/audit/2026-05-05_code-quality.md`
- `docs/audit/2026-05-05_ship-readiness.md`
