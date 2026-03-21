# HOLMES/Moriarty Policies
<!-- docs-truth: status=current owner=@flyingrobots -->

This directory documents how to configure HOLMES/Moriarty’s git-warp-backed counterfactual behavior using a small, safe, JSON policy.

- Spec: docs/holmes-policy-spec.md
- Ready‑to‑use templates: docs/templates/holmes-policy/
  - GitHub, GitLab, Bitbucket, Azure DevOps, Gitea
  - Trunk‑based defaults and stricter hard-gate defaults

Quick start
- Copy a template to `.wesley/holmes-policy.json` at your repo root and tweak as needed.
- Optional developer overrides go in `.wesley/holmes-policy.local.json` (gitignored).
- Run `holmes predict --counterfactual` (or `report`) to see counterfactual results.
- `--project-merge` still works for a short deprecation window, but it is now an alias to the counterfactual path.

Notes
- Policies are JSON only (no code execution) and validated at runtime.
- If a policy is invalid, defaults are used.
- v1 policy files are upcast into the v2 counterfactual shape at runtime, but new policies should use v2 directly.
