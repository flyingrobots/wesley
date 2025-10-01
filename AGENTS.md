# Agents Guide and Policy

This document defines repo‑wide conventions and guardrails for human and AI agents contributing to this project. It applies to the entire repository unless a nested `AGENTS.md` overrides a section. Project owner directions and the conventions in `docs/` take precedence if conflicts arise.

## Scope and Precedence
- Read `docs/` (especially docs/README.md, milestones, and architecture) before changing code or workflows.
- If a directory contains its own `AGENTS.md`, that file’s guidance applies to that subtree.

## Intent and Guardrails
- Prefer minimal, surgical changes that directly address the task. Do not “clean up” unrelated code.
- Do not move/rename files, rewrite workflows, or add dependencies unless strictly required to solve the current issue.
- Preserve CLI voice and demo narrative (BLADE/HOLMES) in user‑facing output.

## CI/CD Philosophy
- Keep “main CI” deterministic and fast. It should run the core project tests and gates; long e2e/bats belong in dedicated workflows.
- The dedicated CLI workflows (e.g., `cli-tests.yml`, `cli-quick.yml`) own CLI end‑to‑end/bats checks. Avoid duplicating them in main CI without approval.
- When failures arise, fix tests/product logic rather than muting or skipping steps. If you must mute, document why and the revert plan.

## Test Policy
- Keep existing test topology: unit, integration, property, snapshots, e2e. Add new tests in the matching suite only.
- Do not weaken assertions just to pass CI unless the behavior is intentionally changed and documented in the PR.
- Snapshot updates require justification in the commit message.

## Workflow Changes
- Only touch `.github/workflows/*` when:
  1) Fixing a deterministic break (syntax/path/quoting), or
  2) Reducing obviously wasteful runtime or duplication;
  and provide a revert path in the PR description.
- Use least privilege; do not widen permissions or add secrets without approval.

## Package Scripts
- Do not convert tests into global “skip” behaviors in `package.json`. Skips should be explicit in workflows or temporary, with a follow‑up issue to restore coverage.

## Branching and PRs
- Branch names: `feat/*`, `fix/*`, `chore/*` with short, descriptive kebab‑case.
- One‑topic PRs with a tight diff. CI should pass unless the PR specifically repairs CI.
- PR description must include context, rationale, alternatives considered, risks, and backout.

## Commit Hygiene
- Use Conventional Commits (e.g., `fix(core): …`, `test(cli): …`, `ci: …`).
- Group related changes; avoid mixing refactors with behavior changes.

## Code Style and APIs
- Follow existing module layout and boundaries; keep public APIs stable. Document migration notes if an API change is intentional.

## Local Verification
- Run the smallest relevant subset first (single package or suite) before the workspace tests. Prefer reproducible commands in your PR notes.

## Runtime/Secrets/DSNs
- Never log secrets or real DSNs in CI or code. Sample DSNs must be clearly fake and documented as such.

## Agent Behavior
- Before edits: state intent and list files you expect to touch.
- After edits: summarize the delta and CI effects (which jobs pass/fail and why).

---

## Agents Activity Log

### 2025-09-29
- Resolved the README merge conflict on `pr-16`, restoring the generate → rehearse → deploy workflow while keeping the new messaging.
- Deleted the stale `.git/.COMMIT_EDITMSG.swp` swap file so the merge could proceed cleanly.
- `pr-16` marked merge‑ready.
