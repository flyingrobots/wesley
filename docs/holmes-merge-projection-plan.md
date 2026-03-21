# Projected-Merge Intelligence for HOLMES/Moriarty
<!-- docs-truth: status=current owner=@flyingrobots -->

Status: superseded.

This document described the older merge-tree / worktree projection plan. Wesley now uses git-warp-backed counterfactual lanes instead.

Use these documents instead:
- `docs/architecture/holmes-counterfactuals.md`
- `docs/holmes-policy-spec.md`

Compatibility note
- The CLI still accepts `--project-merge` for a short deprecation window.
- That flag no longer runs the old projection code path.
- It routes through the counterfactual provider and emits a deprecation warning.
