# HOLMES Policy Templates

Copy one of these JSON files into your repo as `.wesley/holmes-policy.json` and adjust as needed.

Templates
- github-pr-default.json — default for GitHub Actions (on for PRs, on for non‑default branches vs default, off on main)
- gitlab-pr-default.json — same semantics for GitLab CI
- bitbucket-pr-default.json — same semantics for Bitbucket Pipelines
- azure-devops-pr-default.json — same semantics for Azure DevOps
- gitea-pr-default.json — same semantics for Gitea/Drone
- trunk-main-default.json — trunk‑based: off on main; on for all non‑default branches
- strict-trunk-pseudo.json — enforce a pseudo projection on main vs HEAD~1 (confidence penalties if it fails)

Usage
- Start with the provider template that matches your CI.
- Save it as `.wesley/holmes-policy.json` in your repo root.
- Optional: add `.wesley/holmes-policy.local.json` (gitignored) for per‑developer overrides.
- You can later adopt the policy CLI helpers (init/validate/explain) when available.

