# Moriarty Edge-Case Scenarios and Test Plans

Purpose: Enumerate real-world scenarios that stress Moriarty’s predictors and explain how to simulate each in package tests. This document is meant to be living guidance for writing and evolving targeted tests in `packages/wesley-holmes/test`.

Key signals (quick refresher):
- SCS – Schema Coverage (0..1), with EMA-smoothed velocity and slope
- TCI – Test Confidence (0..1)
- MRI – Migration Risk (0..1; lower is better)
- Activity Index – 0..1 blend of PR-graph (preferred) and 24h window activity
  - Components: commits/day, relevant commits/day, relevant LOC/day, relevant files/day
  - Relevant = GraphQL, SQL/DDL, pgTAP, `.wesley/*` artifacts
- Plateau rule – plateauDetected when `|blendedVelocity| < 0.01` AND `activityIndex < 0.35`
- Confidence – derived from series variance; penalized by commit-size “burstiness”
- Readiness EXPLAIN (informational) – PASS/FAIL lines for thresholds:
  - SCS ≥ 0.80, TCI ≥ 0.70, MRI ≤ 0.40, CI stability ≥ 0.90

Test harness knobs:
- History points: `.wesley/history.json`
- Context: `.wesley/moriarty-context.json` (issues closed, PRs merged, CI stability)
- Git activity: parse of `git log` and `git merge-base` (we can stub `git` via PATH)
- CLI: `packages/wesley-holmes/src/cli.mjs predict --json out.json`
- Env tuning (optional): `MORIARTY_*` variables (see docs/architecture/holmes-architecture.md)

General test strategies:
- “Fake git” by injecting a temporary directory with a small executable `git` shim at the front of PATH that prints canned outputs for:
  - `git rev-parse --is-inside-work-tree`
  - `git merge-base HEAD origin/<base>`
  - `git log <range> --pretty=--%ct --numstat --no-merges`
  - `git fetch ...` (no-op success)
- Write minimal `.wesley/history.json` with desired day/timestamp points.
- Optionally write `.wesley/moriarty-context.json` with fields `{ issuesClosed, prsMerged, ci: { stability }, timeframeHours, baseRef }`.
- Run CLI with `spawnSync(node, [cli, 'predict', '--bundle-dir', tmpWesley, '--json', outPath], { env: { ...process.env, PATH: fakePath } })`.
- Parse JSON and assert on: `status`, `velocity.recent`, `velocity.gitActivityIndex`, `plateauDetected`, `eta` presence, `confidence`, `gitActivity`, `patterns`, `explain.*`.

---

## Scenario Catalog

Each scenario below includes: intent, minimal setup, expected outcomes, and concrete test ideas.

1) Stable project, one tiny change after long quiet period
- Intent: Validate plateau detection when both SCS and activity are low.
- Setup:
  - history.json: two points same SCS (e.g., 0.82 → 0.82) days apart
  - git shim: 1 commit with negligible relevant changes in 24h and PR range
  - context: CI stability high (0.95)
- Expect:
  - plateauDetected = true; no ETA
  - Activity index low (< 0.35)
  - EXPLAIN: CI PASS; SCS/TCI/MRI PASS/FAIL based on thresholds
- Test: Assert plateau; assert EXPLAIN lines render with correct PASS/FAIL.

2) Stable project, one massive change in one commit
- Intent: Differentiate “big drop” work from slow drip; apply burstiness penalty.
- Setup: history flat (no SCS change). git shim emits PR range log with 1 commit, thousands of relevant LOC touching 50 files.
- Expect:
  - plateauDetected = false (activity suppresses), but no ETA (SCS flat)
  - Activity index high; confidence reduced by burstiness (≥5% penalty)
- Test: Check `velocity.gitActivityIndex > 0.5` and `confidence` lower than default variance-only case.

3) Tiny change that breaks things
- Intent: Ensure activity doesn’t mask breakage; EXPLAIN remains truthful.
- Setup: history small negative SCS delta or flat; git activity low; context without PR CI (base CI still high).
- Expect: plateauDetected may be true; EXPLAIN could still PASS if scores meet thresholds.
- Test: Note gap; propose adding PR-branch CI pass-ratio (see improvements).

4) Many commits, no artifact movement (SCS unchanged)
- Setup: Multiple PR commits with relevant files, SCS constant.
- Expect: plateauDetected = false; no ETA; explanation line “Low SCS movement, but recent Git activity…”
- Test: Assert plateau=false and `eta` absent.

5) Doc-only churn
- Setup: git shim logs only docs; history flat.
- Expect: activity index low; plateauDetected = true
- Test: Assert plateau=true; activity index < 0.35.

6) Big rename refactors (MRI.renames missing)
- Setup: SCS moves; generator’s MRI.renames not populated.
- Expect: MRI remains low; EXPLAIN MRI may PASS unexpectedly.
- Test: Document as known gap; assert current behavior; file follow-up issue when MRI.renames implemented.

7) Heavy destructive migrations (drops)
- Setup: history with same SCS; bundle scores include MRI.drops high → MRI total > 0.4.
- Expect: EXPLAIN MRI FAIL; Holmes gate warns.
- Test: Assert EXPLAIN MRI line shows FAIL.

8) Velocity cliff (burst then stall)
- Setup: history showing increase then flat; git activity decaying.
- Expect: pattern `VELOCITY_CLIFF`; confidence lower via variance.
- Test: Assert `patterns` contains `VELOCITY_CLIFF` and confidence lower than steady case.

9) Long-lived PR with small steady commits
- Setup: history steady SCS increases; git activity modest but persistent.
- Expect: plateau=false; ETA present; high confidence; blended velocity ~recent slope.
- Test: Assert ETA present and `confidence > 70`.

10) Force-push / history rewrite
- Setup: emulate PR range with replaced commits; history points noisy.
- Expect: velocity may wobble; confidence down via variance.
- Test: Compare confidence to steady series; assert lower.

11) Shallow clone / git graph unavailable
- Setup: git shim returns non-zero for `rev-parse`; or omit shim entirely.
- Expect: fallback to SCS-only; no `gitActivity` object; plateau likely if SCS flat.
- Test: Assert `gitActivity === undefined` and plateau computed from SCS only.

12) No history (<2 points)
- Setup: history.json with one point.
- Expect: status = `INSUFFICIENT_DATA` and explanatory text.
- Test: Assert status and message.

13) SCS high, TCI low (test lag)
- Setup: scores with SCS ≥ 0.8, TCI < 0.5.
- Expect: pattern `TEST_LAG`; EXPLAIN SCS PASS, TCI FAIL.
- Test: Assert both.

14) TCI high, SCS low
- Setup: SCS < 0.5, TCI ≥ 0.7.
- Expect: EXPLAIN SCS FAIL, TCI PASS; no readiness.
- Test: Assert EXPLAIN lines reflect that.

15) Non-relevant churn + tiny SQL tweak
- Setup: git logs include many non-relevant file changes; a single small SQL delta.
- Expect: activity index remains low-medium; if SCS flat, plateau true; if SCS moved, small velocity.
- Test: Assert index < 0.35 if relevant weight is tiny.

16) Huge change split across 20 commits (healthy spread)
- Setup: PR log with 20 relevant commits, balanced sizes; history with SCS increases.
- Expect: high index, low burstiness → higher confidence; ETA present.
- Test: Compare confidence vs single-mega-commit case; assert higher.

17) Break/fix sequence before bundle refresh
- Setup: simulate several commits but history not updated between break/fix.
- Expect: report smooth; known blind spot without PR CI.
- Test: Document; propose PR CI signal addition (see improvements).

18) Monorepo unrelated churn
- Setup: PR log with unrelated paths only; history flat.
- Expect: activity index low; plateau true.
- Test: Assert plateau.

19) Weight configuration change only
- Setup: scores.json unchanged; weights.json modified.
- Expect: Moriarty SCS unaffected; Holmes table explains weight sources.
- Test: Assert Moriarty headline unchanged; rely on Holmes unit tests for weights.

20) Flaky CI on base
- Setup: context ci.stability < 0.9.
- Expect: EXPLAIN CI FAIL line, informational.
- Test: Assert EXPLAIN CI shows FAIL; readiness isn’t auto-blocked by that alone.

21) PR from fork (API limited)
- Setup: context step absent; no moriarty-context.json.
- Expect: EXPLAIN omits delivery lines; core unaffected.
- Test: Assert absence of `explain.delivery` keys does not crash.

22) Rename without @uid continuity
- Setup: MRI.renames currently not populated; treat as gap.
- Expect: MRI lower than it should be.
- Test: Track improvement when generator adds renames vector.

23) Intra-day re-runs
- Setup: multiple points with same `day`, slightly increasing SCS.
- Expect: recent velocity somewhat attenuated; still positive.
- Test: Assert velocity > 0; consider timestamp-based refinement later.

24) Generated folder layout differences
- Setup: put relevant SQL under a non-standard path; current filters may miss.
- Expect: lower activity index.
- Test: Document repository-specific include list; propose config hook.

25) High SCS/TCI but MRI spike (drops)
- Setup: SCS ≥ 0.8, TCI ≥ 0.7, MRI > 0.4.
- Expect: EXPLAIN MRI FAIL; readiness not implied.
- Test: Assert FAIL and Holmes gate messages.

26) Stop-start progress (high variance)
- Setup: alternating increases and flats in SCS over many points.
- Expect: lower confidence despite adequate current velocity.
- Test: Assert `confidence` lower vs steady series baseline.

27) “Work without evidence” (activity high, SCS flat for N days)
- Setup: many PR commits with relevant files; SCS unchanged over several points.
- Expect: plateau suppressed; no ETA; (proposed) pattern `EVIDENCE_LAG`.
- Test: For now assert no ETA; add pattern when implemented.

---

## Concrete Test Recipes

Utility fixture writers (proposed):
- `writeHistory(dir, points)` → writes `.wesley/history.json` with `{ points }`
- `writeContext(dir, ctx)` → writes `.wesley/moriarty-context.json`
- `withFakeGit(scripts, fn)` → prepends a temp dir to PATH containing a `git` script that inspects `process.argv` and prints canned outputs for commands used by Moriarty

Git outputs format examples:
- `git log --since='ISO' --pretty=--%ct --numstat --no-merges`
  - Emit blocks like:
    ```
    --1730000000
    120  10  schema.graphql
    33   0   out/ddl/schema.sql
    --1730003600
    0    1   README.md
    ```
- `git log <mergeBase>..HEAD --pretty=--%ct --numstat --no-merges` for PR graph
- `git merge-base HEAD origin/main` → print a dummy SHA string
- `git rev-parse --is-inside-work-tree` → exit 0

Assertions to standardize:
- Plateau: `json.plateauDetected === true/false`
- ETA presence: `json.eta` exists or not
- Activity index: `json.velocity.gitActivityIndex ∈ [0,1]`
- Blended velocity: sign and magnitude sanity checks
- Confidence deltas: compare scenarios (mega-commit vs distributed, steady vs variance)
- Patterns: presence of `TEST_LAG`, `VELOCITY_CLIFF`, future `EVIDENCE_LAG`
- EXPLAIN lines: SCS/TCI/MRI/CI pass/fail correspond to thresholds and inputs

---

## Follow-ups / Enhancements for Better Fidelity

- Add PR-branch CI pass ratio to EXPLAIN and optionally as a guardrail line.
- Populate MRI.renames/typeChanges in the generator for realistic risk assessment.
- Switch recent-velocity calc to timestamp resolution for intra-day runs.
- Add `EVIDENCE_LAG` pattern (high activity, flat SCS over N days).
- Repository-configurable “relevant file” overrides for activity parsing.

When these land, update the scenarios and test recipes accordingly.

