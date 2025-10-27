# HOLMES/Moriarty Policy Spec (v1)

Purpose
- Make projected-merge intelligence host‑agnostic and configurable without code changes.
- Let teams teach HOLMES/Moriarty their workflow (when to project, what base to use, and how projection affects readiness).

What This Controls
- Whether to run merge projection (auto | on | off | pseudo)
- How to select the base ref (CI env, default branch, literal ref)
- Penalties and readiness impact when we cannot produce a clean projection
- Optional strict trunk policies (pseudo projection on default branch)

Files
- `.wesley/holmes-policy.json` (checked in; reviewed in PRs)
- `.wesley/holmes-policy.local.json` (developer overrides; gitignored)

CLI / Env
- Flags
  - `--project-merge=auto|on|off|pseudo` (default: auto)
  - `--base-ref <ref>` (literal override)
  - `--policy <path>` (optional; otherwise autodetected)
- Env
  - `MORIARTY_PROJECT_MERGE_MODE=auto|on|off|pseudo`
  - `MORIARTY_BASE_REF=<ref>`
  - `MORIARTY_POLICY_FILE=<path>`

JSON Schema (v1)
- Top-level
  - `version` (number, required; current: 1)
  - `defaults` (object)
  - `rules` (array; first match wins)
- defaults
  - `mode`: "auto" | "on" | "off" | "pseudo" (default: "auto")
  - `assumeDefaultBranch`: string (default: "main")
  - `penalties`: { `projectionError`: number, `projectionConflicts`: number } (default 50/30)
  - `fetchBase`: boolean (default true) – allow `git fetch` of base
  - `useProviderAPI`: boolean (default false) – allow host API lookup if token present
  - `pseudoAgainst`: string (default "HEAD~1") – used when `mode=pseudo`
- rules[] (first match wins)
  - when
    - `event`: "pull_request" | "push" | "manual" | "ci" | "local"
    - `provider`: "github" | "gitlab" | "bitbucket" | "azure" | "gitea" | "unknown"
    - `branchEquals`: string
    - `branchMatches`: string | string[] (gitignore‑style; supports !negation)
    - `env`: object map of NAME → "exact" or "/regex/"
    - `fileExists`: string | string[] (relative paths)
  - then
    - `mode`: "auto" | "on" | "off" | "pseudo"
    - `baseFrom`: "ci_env" | "default_branch" | "open_pr_base_or_default" | "literal"
    - `baseRef`: string (used when `baseFrom="literal"`)
    - `penalties`: { `projectionError`?: number, `projectionConflicts`?: number }
    - `enforceOnDefault`: boolean
    - `pseudoAgainst`: string
    - `readinessImpact`: { `confidencePenalty`?: number, `confidenceMin`?: number, `gateFail`?: boolean }
    - `notes`: string

Auto Mode (Host‑Agnostic)
- Context detection (no network required):
  - provider: inferred from CI env presence (github, gitlab, bitbucket, azure, gitea) else "unknown"
  - event: pull_request if a known PR env var exists; push if push; local otherwise
  - branch: `git rev-parse --abbrev-ref HEAD`
  - defaultBranch: `git symbolic-ref refs/remotes/origin/HEAD` → `origin/main`; fallback = `defaults.assumeDefaultBranch`
- Decision (defaults):
  - On PR: `mode=on`, `baseRef` from CI env
  - On non‑default branch w/o PR: `mode=on`, `baseRef=defaultBranch`
  - On default branch: `mode=off` (n/a) unless policy sets `pseudo`

CI Env → baseRef mapping (read only)
- GitHub: `GITHUB_BASE_REF`
- GitLab: `CI_MERGE_REQUEST_TARGET_BRANCH_NAME`
- Bitbucket: `BITBUCKET_PR_DESTINATION_BRANCH`
- Azure DevOps: `SYSTEM_PULLREQUEST_TARGETBRANCH`
- Gitea/Drone: `DRONE_TARGET_BRANCH`
- Fallback: `MORIARTY_BASE_REF` or policy default

Execution Semantics
- If `mode` is `on` or `pseudo`:
  - Try merge‑tree → fallback to worktree
  - status=clean: record mergedTree; later phases compute `projection.scores` + `projection.delta`
  - status=conflicts or error: apply penalties from policy (default: −30/−50), add `MERGE_PROJECTION_ISSUE` pattern
- If `mode` is `off`:
  - `projection.status = "n/a"` with reason; never penalize

Readiness Impact (extensible)
- Today: confidence penalties on non‑clean/projection failure
- Optional (future): clamp `confidenceMin` and/or add a readiness gate `Projection Clean`

Developer UX
- (Future) `holmes policy init` — scaffold a policy from templates
- `holmes policy validate` — validate file against the JSON schema
- `holmes policy explain` — print matched rule, decision (mode, baseRef), and reasons (env/branch)

Validation & Safety
- Strict JSON validation; if invalid, fall back to defaults and record a diagnostic pattern
- No code execution in policy files
- No host API calls unless `useProviderAPI=true` and token present (never default)

Templates
- Ready‑to‑use policy templates live under `docs/templates/holmes-policy/` for GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, and trunk‑based flows. Copy the closest template to `.wesley/holmes-policy.json` and tweak as needed.

Implementation Phases
- A: Policy loader + auto mode + CLI wiring (no behavior change without policy or flag)
- B: Materialize merged tree + generate projected bundle + compute `projection.scores` + `projection.delta`
- C: Docs & templates (this doc); optional policy CLI helpers

