# HOLMES/Moriarty Policies

This directory documents how to configure HOLMES/Moriarty’s projected‑merge behavior using a small, safe, JSON policy.

- Spec: docs/holmes-policy-spec.md
- Ready‑to‑use templates: docs/templates/holmes-policy/
  - GitHub, GitLab, Bitbucket, Azure DevOps, Gitea
  - Trunk‑based defaults and strict‑trunk pseudo‑projection

Quick start
- Copy a template to `.wesley/holmes-policy.json` at your repo root and tweak as needed.
- Optional developer overrides go in `.wesley/holmes-policy.local.json` (gitignored).
- Run `holmes predict --project-merge` (or `report`) to see projection results. Auto mode is policy‑driven and host‑agnostic.

Notes
- Policies are JSON only (no code execution) and validated at runtime.
- If a policy is invalid, defaults are used and a diagnostic note is added to the report.
