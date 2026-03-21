# HOLMES Policy Templates
<!-- docs-truth: status=current owner=@flyingrobots -->

Copy one of these JSON files into your repo as `.wesley/holmes-policy.json` and adjust as needed.

Templates
- github-pr-default.json — audit-mode counterfactuals against `main`
- gitlab-pr-default.json — audit-mode counterfactuals against `main`
- bitbucket-pr-default.json — audit-mode counterfactuals against `main`
- azure-devops-pr-default.json — audit-mode counterfactuals against `main`
- gitea-pr-default.json — audit-mode counterfactuals against `main`
- trunk-main-default.json — enabled with `gateMode: off`
- strict-trunk-pseudo.json — legacy filename preserved; now a hard-gate counterfactual template

Usage
- Start with the provider template that matches your CI.
- Save it as `.wesley/holmes-policy.json` in your repo root.
- Optional: add `.wesley/holmes-policy.local.json` (gitignored) for per‑developer overrides.
- `holmes predict --counterfactual` and `holmes report --counterfactual` consume these files now.
- `--project-merge` is deprecated and routes through the same counterfactual provider.
