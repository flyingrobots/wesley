# GH-266 Policy: Corepack + frozen lockfile + selective pre-commit guard

- Imported from: GitHub issue
- Issue: #266
- URL: https://github.com/flyingrobots/wesley/issues/266
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:23Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `chore`, `ci`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Establish and document a single-source-of-truth package manager + lockfile policy for the monorepo, and enforce it locally/CI.

Why

- CI was rewriting pnpm-lock.yaml due to mixed pnpm majors and `--no-frozen-lockfile`.
- Lockfile churn = flaky preflight + confusing diffs.

What

- Source of truth: `package.json: "packageManager": "pnpm@9.15.9"`.
- CI: use `pnpm/action-setup@v4` (no version input → reads packageManager), install with `pnpm install --frozen-lockfile`, and fail if the lockfile changes (`git diff --exit-code pnpm-lock.yaml`).
- Preflight: verify `pnpm --version` matches packageManager and fail with a clear `corepack prepare pnpm@… --activate` hint.
- Pre-commit: selectively refresh pnpm-lock.yaml only when dependency resolution changes (deps/overrides/workspaces or `packageManager`) and stage it.
- Single lockfile policy: preflight fails if `yarn.lock`, `package-lock.json`, or nested lockfiles exist.
- Docs: CONTRIBUTING.md section on Corepack + lockfile workflow.

Acceptance

- CI green with frozen installs.
- Local commits that change deps auto-stage a matching lockfile.
- Preflight blocks wrong pnpm versions with a friendly message.
