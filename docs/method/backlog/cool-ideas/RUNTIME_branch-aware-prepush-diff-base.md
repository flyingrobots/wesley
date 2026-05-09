# Branch-aware pre-push diff base

- Lane: `cool-ideas`
- Legend: `RUNTIME`

## Why now

The pre-push sanity script selects checks from changed files. On first push or
branches without upstreams, it falls back to `origin/main`, which can over-select
files for release-targeted branches and make local pushes feel unrelated to the
actual PR target.

## Hill

Pre-push sanity chooses a diff base that matches the branch stack a developer is
actually pushing.

## Done looks like

- tracking branch remains the first choice when available
- `WESLEY_BASE_REF`, `GITHUB_BASE_REF`, or release branch metadata can steer the
  fallback before `origin/main`
- dry-run output prints the selected base and why it was chosen
- tests cover first push, release-targeted branch, tracked branch, and explicit
  `--files` override paths

## Repo Evidence

- `scripts/pre-push-sanity.mjs`
