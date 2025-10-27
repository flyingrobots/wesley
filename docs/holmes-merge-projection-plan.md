# Projected-Merge Intelligence for HOLMES/Moriarty

Goal: For pull requests, simulate the post-merge repository state against the target branch, run Wesley/HOLMES/WATSON/Moriarty on that state, and surface projected readiness alongside the current-HEAD metrics.

Outcomes
- Add `projection` to Moriarty JSON: clean/conflicts status, projected scores, and deltas vs HEAD.
- CLI flags/env to enable projection for PRs (auto-detect base via `GITHUB_BASE_REF` or `MORIARTY_BASE_REF`).
- Minimal, non-invasive: no commits, no persistent branches; all temp-only.

Architecture
- MergePlanner: strategy interface with two implementations:
  - merge-tree (preferred): compute merged tree with `git merge-tree --write-tree <base> <merge-base> <head>`; no worktree side effects.
  - worktree fallback: ephemeral `git worktree` from base, `git merge --no-commit --no-ff <HEAD>`; detect conflicts and clean up.
- Analysis: materialize merged tree to a temp dir, generate a temporary Wesley bundle, run HOLMES/WATSON/Moriarty, and compute deltas.
- Caching: keyed by `(HEAD, baseRef, mergeBase)`; skip if identical to HEAD tree.

CLI/Schema Changes
- `holmes predict --project-merge [<baseRef>]` and `holmes report --project-merge [<baseRef>]`.
- Env toggles: `HOLMES_PROJECT_MERGE=1`, `MORIARTY_BASE_REF=<ref>`.
- moriartyReportSchema: add `projection` (status, merge meta, scores, deltas).
- Report rendering: section “Projected After Merge” (side-by-side highlights).

Risk/Performance
- No persistent repo state; temp dirs only; tolerant of older Git via fallback.
- Degrade gracefully: `projection.status` = `conflicts` or `error` with diagnostics.

Phases (bite-sized)
1) Interface + plumbing (flags/env/schema skeleton)
2) Clean-merge path (merge-tree) + JSON render
3) Fallback/conflict path (worktree) + conflict reporting
4) Integration, caching, CI wiring, docs

See `scripts/gh-issues/issue_plan.json` for the granular “1 issue = 1 deliverable” breakdown, each ≤ 3 hours.

Templates & Spec
- Ready‑to‑use policy templates: `docs/templates/holmes-policy/` (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, trunk flows). Copy the closest template to `.wesley/holmes-policy.json`.
- Full policy specification: `docs/holmes-policy-spec.md`.

How to create issues (org-level project)
- Prereqs: gh CLI authed (gh auth status) with repo + project access.
- Set env and run:
  - `export GH_OWNER=flyingrobots`
  - `export GH_REPO=wesley`
  - `export GH_PROJECT_TITLE=Wesley`  # org-level Projects v2 title
  - `export GH_PROJECT_ORG=1`
  - Optional: `export GH_LABELS="merge-projection,holmes,moriarty"`
  - Run: `node scripts/gh-issues/create_issues.mjs`

Project fields used
- Priority: single-select values P0–P4 (P0 highest). The script removes any non-standard Priority field and creates this one. It also attempts to set descriptive option names, e.g., “P0 – Critical (prod/customer impact; start immediately)”.
- Estimate (human hours): number.

Repository labels ensured
- P0 (red), P1 (orange), P2 (yellow), P3 (green), P4 (gray)
- Also adds generic labels: merge-projection, holmes, moriarty
