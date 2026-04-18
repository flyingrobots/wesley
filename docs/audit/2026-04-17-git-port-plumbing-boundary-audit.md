# 2026-04-17 git-port-plumbing-boundary audit

## Scope

This audit checks Wesley for direct `git` subprocess usage after establishing
the `git-port-plumbing-boundary` invariant.

Command used:

```bash
rg -n "spawnSync\\('git'|execFileSync\\('git'|execSync\\('git'|spawn\\('git'|execFile\\('git'" \
  packages scripts test -g '!**/node_modules/**'
```

## Result

The invariant is currently violated.

- 30 direct `git` subprocess call sites
- 16 files
- 4 repo script call sites
- 22 production/runtime package call sites
- 4 Holmes test-helper call sites

## Highest-risk findings

### 1. Holmes mixes bespoke Git code with partial plumbing adoption

- `packages/wesley-holmes/src/ports/git.mjs`
- `packages/wesley-holmes/src/merge/MergeTreeStrategy.mjs`
- `packages/wesley-holmes/src/merge/WorktreeStrategy.mjs`
- `packages/wesley-holmes/src/Watson.mjs`

These files shell out to `git` directly even though Holmes already declares
`@git-stunts/plumbing` as a dependency.

### 2. Counterfactual provider is split-brained

- `packages/wesley-holmes/src/counterfactual/provider.mjs`

This file already imports `@git-stunts/plumbing` and uses it for the provider
store, but still shells out directly to `git` for repo initialization,
ref resolution, and archive materialization.

### 3. Holmes tests use raw Git helpers

- `packages/wesley-holmes/test/citation-truthfulness.test.mjs`
- `packages/wesley-holmes/test/cli-options.test.mjs`
- `packages/wesley-holmes/test/counterfactual-provider.test.mjs`
- `packages/wesley-holmes/test/projection-regression.test.mjs`

These helpers call `spawnSync('git', ...)` directly. Under a Git hook,
inherited `GIT_DIR` can redirect those commits into the real repo even when the
test thinks it is operating in `/tmp`.

### 4. Repo tooling still shells out directly

- `scripts/pre-push-sanity.mjs`
- `scripts/preflight.mjs`
- `scripts/compute-progress.mjs`
- `packages/wesley-cli/src/commands/contract.mjs`
- `packages/wesley-cli/src/commands/realization-integrity.mjs`
- `packages/wesley-host-node/src/adapters/WesleyFileWriter.mjs`
- `packages/wesley-runtime-node/src/GitWarpEventStore.mjs`

These are not Holmes-specific. The invariant is repo-wide, so they count too.

## Direct call-site inventory

- `scripts/compute-progress.mjs:26`
- `scripts/preflight.mjs:221`
- `scripts/preflight.mjs:225`
- `scripts/pre-push-sanity.mjs:216`
- `packages/wesley-runtime-node/src/GitWarpEventStore.mjs:103`
- `packages/wesley-host-node/src/adapters/WesleyFileWriter.mjs:128`
- `packages/wesley-cli/src/commands/contract.mjs:943`
- `packages/wesley-cli/src/commands/realization-integrity.mjs:508`
- `packages/wesley-holmes/src/ports/git.mjs:39`
- `packages/wesley-holmes/src/ports/git.mjs:51`
- `packages/wesley-holmes/src/ports/git.mjs:63`
- `packages/wesley-holmes/src/ports/git.mjs:92`
- `packages/wesley-holmes/src/counterfactual/provider.mjs:522`
- `packages/wesley-holmes/src/counterfactual/provider.mjs:541`
- `packages/wesley-holmes/src/counterfactual/provider.mjs:546`
- `packages/wesley-holmes/src/merge/MergeTreeStrategy.mjs:17`
- `packages/wesley-holmes/src/merge/MergeTreeStrategy.mjs:27`
- `packages/wesley-holmes/src/merge/MergeTreeStrategy.mjs:35`
- `packages/wesley-holmes/src/merge/MergeTreeStrategy.mjs:47`
- `packages/wesley-holmes/src/merge/MergeTreeStrategy.mjs:59`
- `packages/wesley-holmes/src/merge/MergeTreeStrategy.mjs:60`
- `packages/wesley-holmes/src/merge/WorktreeStrategy.mjs:23`
- `packages/wesley-holmes/src/merge/WorktreeStrategy.mjs:27`
- `packages/wesley-holmes/src/merge/WorktreeStrategy.mjs:53`
- `packages/wesley-holmes/src/merge/WorktreeStrategy.mjs:85`
- `packages/wesley-holmes/src/Watson.mjs:276`
- `packages/wesley-holmes/test/citation-truthfulness.test.mjs:254`
- `packages/wesley-holmes/test/cli-options.test.mjs:134`
- `packages/wesley-holmes/test/counterfactual-provider.test.mjs:107`
- `packages/wesley-holmes/test/projection-regression.test.mjs:15`

## Immediate corrective direction

- define one sanctioned `GitPort` for Wesley
- back the real adapter with `@git-stunts/plumbing`
- route Holmes runtime, CLI/runtime adapters, and repo tooling through that
  adapter
- replace raw Git test helpers with fake ports or plumbing-backed temp repo
  helpers
- strip inherited `GIT_*` variables at hook and test-runner boundaries until
  the cutover is complete
