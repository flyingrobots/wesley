# Tasks

```
████|████|██░░|░░░░|░░░░|░░░░|░░░░|░░░░|░░░░|░░░░|
    |    |    |    |    |    |    |    |    |    |
0   10   20   30   40   50   60   70   80   90  100

26 %
10 of 38 resolved
```

---

## [I] Duplicate runtime scripts DRY refactor

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Reduce duplication across the three host contract runners by extracting a shared harness (or document why duplication is intentional).
> 
> **Where**
> - `tasks.md:311` (“Blatant code duplication across runtime scripts” under `scripts/host_contracts_node.mjs` context).
>   
> **Affected Files**
> - [x] `scripts/host_contracts_node.mjs`
> - [x] `scripts/host_contracts_deno.ts`
> - [x] `scripts/host_contracts_bun.mjs`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Extracted a shared runner (`scripts/host_contracts_runner.mjs`) and updated Node/Bun/Deno entrypoints to delegate to it. Runner emits JSON and sets exit code consistently across runtimes. Duplicated glue code removed; behavior preserved. Fix commit: `eeb156998576443ee0524a5e3b9fd46d148d6829`.  

## [II] Browser runtime: WebCrypto guard

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> In the browser host runtime’s sha256Hex, check globalThis.crypto?.subtle and throw a clear error if unavailable.
> 
> **Where** 
> In tasks.md: tasks.md:1006 (“Guard WebCrypto: fail loudly when crypto.subtle is absent.”).
> 
> **Affected Files** 
> - [x] `packages/wesley-host-browser/src/createBrowserRuntime.mjs`
> 

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Verified guard is present: `sha256Hex` checks `globalThis.crypto?.subtle` and throws a clear error when unavailable. Documented this behavior in `docs/hosts/browser.md`. No code change required. Doc commit: `63fa1887ffb6ef5c6e5c621572fddcccd4e7257d`.  

## [III] Browser runtime: sanitizeGraphQL regex control chars

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Replace regexes that include control characters (BOM/NULL) with string ops to avoid linter issues.
> 
> **Where**
> - `tasks.md:1032–1048` (sanitizeGraphQL change block).
>   
> **Affected Files**
> - [x] `packages/wesley-host-browser/src/createBrowserRuntime.mjs`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Confirmed `sanitizeGraphQL` uses BOM stripping and null-byte removal via string operations (no control characters inside regex). No code change required. Doc commit: `63fa1887ffb6ef5c6e5c621572fddcccd4e7257d`.  

## [IV] Progress math: Prototype stage multiplier

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Fix Prototype progress math to match the doc (use 50 or 100, not 25–50).
> 
> **Where**
> - `tasks.md:1103–1116` (“Prototype progress math doesn’t match the comment.”).
>   
> **Affected Files**
> - [x] `scripts/compute-progress.mjs`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Verified implementation already matches the doc: Prototype progress is either 50% (no usage docs) or 100% (usage present). Clarified the inline comment to lock intent. Fix commit: `100972d046225791ccaa7dc4f51ba6df5c15ff2f`.  

## [V] Progress aggregation: weight defaulting and logging

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Don’t silently default unknown weights; warn and convert via a `wNum` variable before accumulation.
> 
> **Where**
> - `tasks.md:1120–1136` (“Silent weight defaulting masks config errors. Log or validate.”).
>   
> **Affected Files**
> - [x] `scripts/compute-progress.mjs`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Replaced silent defaulting with an explicit warning and safe default, and normalized with `wNum`: when a required package weight is missing, we log a warning and use `0.01` rather than silently coerce. Accumulators now use `wNum`. Fix commit: `100972d046225791ccaa7dc4f51ba6df5c15ff2f`.  

## [VI] Progress badges: repo fallback behavior

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Don’t hardcode a fallback GitHub repo for CI badges; show an em‑dash when repo is unknown.
> 
> **Where**
> - `tasks.md:1144–1156` (“Hardcoded repo fallback is brittle. Don’t lie when repo is unknown.”).
>   
> **Affected Files**
> - [x] `scripts/compute-progress.mjs`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Local/offline runs no longer fail when `GITHUB_REPOSITORY` is unset. We warn and render an em dash (—) for CI badges in the README table when the repo is unknown. Overall shield endpoint remains generated. Fix commit: `100972d046225791ccaa7dc4f51ba6df5c15ff2f`.  

## [VII] CI: Deduplicate apt-get installs in runtime-smokes

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Extract repeated `apt-get update && apt-get install -y bats jq` into a reusable step (composite action, reusable workflow, or shared job). Run once; reuse across jobs.
> 
> **Where**
> - `.github/workflows/runtime-smokes.yml:15–25, 31–41, 55–60` (duplicate installs across jobs).
>   
> **Affected Files**
> - [x] `.github/workflows/runtime-smokes.yml`
> - [x] `.github/actions/install-bats/action.yml`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Extracted `apt-get update && apt-get install -y bats jq` into a composite action at `.github/actions/install-bats`. Updated all jobs in `runtime-smokes.yml` to use the action. Note: GitHub jobs run on isolated runners; you cannot literally run apt once for all jobs, but the step is now DRY and managed in one place. Fix commit: `71d42b0`.  

## [VIII] Docs: trim trailing whitespace in host-node README

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Remove trailing spaces on the status line; optionally scan other README badge lines for the same issue.
> 
> **Where**
> - `packages/wesley-host-node/README.md:3` (trailing whitespace on status line).
>   
> **Affected Files**
> - [x] `packages/wesley-host-node/README.md`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Removed trailing double space on the Status line. No rendering change intended; avoids stray whitespace diffs. Fix commit: `71d42b0`.  

## [IX] Docs: trim trailing whitespace in slaps README

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Remove trailing spaces after “Status: Active”.
> 
> **Where**
> - `packages/wesley-slaps/README.md` (status line trailing whitespace).
>   
> **Affected Files**
> - [x] `packages/wesley-slaps/README.md`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Removed trailing double space on the Status line to prevent accidental whitespace-only changes. Fix commit: `71d42b0`.  

## [X] Deno smoke: remove unused lint ignore

> [!info] **Status**
>
> - [x] Acknowledged
> - [x] Resolved

> [!abstract]- 
> 
> **What**
> Delete `// deno-lint-ignore-file no-explicit-any` at file top; no `any` usages present.
> 
> **Where**
> - `scripts/deno_smoke.ts` (top-of-file directive).
>   
> **Affected Files**
> - [x] `scripts/deno_smoke.ts`
>

> [!success]- **Outcome**
> - [x] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Removed `// deno-lint-ignore-file no-explicit-any` from `scripts/deno_smoke.ts`; the file does not use `any`, so the directive was redundant. Fix commit: `71d42b0`.  

## [XI] Bun host contracts: error handling and exit code

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Wrap `await runAll()` in try/catch; log errors to stderr and exit non‑zero on failure.
> 
> **Where**
> - `scripts/host_contracts_bun.mjs` (main execution path).
>   
> **Affected Files**
> - [ ] `scripts/host_contracts_bun.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XII] Deno host contracts: error handling and exit code

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Wrap `await runAll()` in try/catch; `console.error` on failure and `Deno.exit(1)`; `Deno.exit(0)` on success (or allow natural 0 exit).
> 
> **Where**
> - `scripts/host_contracts_deno.ts` (main execution path).
>   
> **Affected Files**
> - [ ] `scripts/host_contracts_deno.ts`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XIII] Deno host contracts: file type vs. runtime alignment

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Either add proper TypeScript types/annotations for Deno or rename to a JS module (`.mjs`/`.js`) so extension and runtime match.
> 
> **Where**
> - `scripts/host_contracts_deno.ts` (currently untyped TypeScript).
>   
> **Affected Files**
> - [ ] `scripts/host_contracts_deno.ts`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XIV] Node host contracts: error handling and exit code

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Wrap top‑level `await runAll()` in try/catch; on failure log to stderr and set `process.exitCode = 1` (or `process.exit(1)`).
> 
> **Where**
> - `scripts/host_contracts_node.mjs` (main entrypoint).
>   
> **Affected Files**
> - [ ] `scripts/host_contracts_node.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XV] Static server: correct .js MIME type

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Serve `.js` as `application/javascript; charset=utf-8` instead of `text/javascript`.
> 
> **Where**
> - `scripts/serve-static.mjs` (contentType map).
>   
> **Affected Files**
> - [ ] `scripts/serve-static.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XVI] Static server: avoid leaking errors to clients

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Log full error server‑side; return generic 500 body to clients.
> 
> **Where**
> - `scripts/serve-static.mjs` (catch block response).
>   
> **Affected Files**
> - [ ] `scripts/serve-static.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XVII] Browser contracts spec: env var name consistency

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Rename constant from `OUT` to `OUT_JSON` (or change env var) and update all usages consistently.
> 
> **Where**
> - `test/browser/contracts/host-contracts.spec.mjs` (env var handling at top; conditional around line 11).
>   
> **Affected Files**
> - [ ] `test/browser/contracts/host-contracts.spec.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XVIII] Browser contracts spec: clarify orchestration and URL

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Add a top‑of‑file comment documenting orchestration by `scripts/host_contracts_browser.mjs`, server URL `http://127.0.0.1:8787`, and how to run.
> 
> **Where**
> - `test/browser/contracts/host-contracts.spec.mjs` (header comment).
>   
> **Affected Files**
> - [ ] `test/browser/contracts/host-contracts.spec.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XIX] Browser contracts spec: stronger assertions on failures

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Replace `expect(res && res.failed === 0).toBeTruthy()` with explicit assertions for presence and `failed === 0`.
> 
> **Where**
> - `test/browser/contracts/host-contracts.spec.mjs` (test assertions).
>   
> **Affected Files**
> - [ ] `test/browser/contracts/host-contracts.spec.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XX] Contracts util: WebCrypto availability guard

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Guard `sha256Hex` to throw an explicit error if `globalThis.crypto?.subtle` is unavailable.
> 
> **Where**
> - `test/contracts/host-contracts.mjs` (sha256Hex helper).
>   
> **Affected Files**
> - [ ] `test/contracts/host-contracts.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXI] Browser-smoke CI: remove pointless npm version check

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Drop `npm -v >/dev/null 2>&1 || npm ci`; install Playwright directly or use `pnpm install --frozen-lockfile` explicitly.
> 
> **Where**
> - `.github/workflows/browser-smoke.yml:46–49` (install step).
>   
> **Affected Files**
> - [ ] `.github/workflows/browser-smoke.yml`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXII] pkg-core CI: quote token starting with '@'

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Wrap run command containing an `@` token in double‑quotes to avoid YAML parse errors.
> 
> **Where**
> - `.github/workflows/pkg-core.yml:28–29` (run command with unquoted `@`).
>   
> **Affected Files**
> - [ ] `.github/workflows/pkg-core.yml`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXIII] pkg-host-bun CI: add concurrency + timeout

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Add top‑level `concurrency` with `cancel-in-progress: true` and a job `timeout-minutes` to prevent duplicate runs and hangs.
> 
> **Where**
> - `.github/workflows/pkg-host-bun.yml:3–22` (workflow header and bun-host job).
>   
> **Affected Files**
> - [ ] `.github/workflows/pkg-host-bun.yml`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXIV] CI: pin Bun version (runtime-smokes + pkg-host-bun)

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Replace `bun-version: latest` with a fixed stable version (e.g., `1.2.20`) for reproducibility.
> 
> **Where**
> - `.github/workflows/runtime-smokes.yml` (around 37–39).
> - `.github/workflows/pkg-host-bun.yml` (same change).
>   
> **Affected Files**
> - [ ] `.github/workflows/runtime-smokes.yml`
> - [ ] `.github/workflows/pkg-host-bun.yml`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXV] Host-bun: document limitations of regex GraphQL shim

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Add a comment noting the inline regex GraphQL parser is minimal and not production‑grade (multi‑line directives, inter‑token comments, etc.).
> 
> **Where**
> - `packages/wesley-host-bun/src/index.mjs` (inline parser comment above implementation).
>   
> **Affected Files**
> - [ ] `packages/wesley-host-bun/src/index.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXVI] Host-deno: WebCrypto guard in sha256Hex

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Check for `crypto?.subtle` before `digest`; throw a clear error if unavailable.
> 
> **Where**
> - `packages/wesley-host-deno/mod.ts` (sha256Hex function).
>   
> **Affected Files**
> - [ ] `packages/wesley-host-deno/mod.ts`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXVII] Progress: parameterize coverage summary path per package

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Stop reading a hardcoded `packages/wesley-core/coverage/coverage-summary.json` inside a loop; parameterize by package.
> 
> **Where**
> - `scripts/compute-progress.mjs` (coverage path inside package loop).
>   
> **Affected Files**
> - [ ] `scripts/compute-progress.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXVIII] Browser contracts orchestrator: dedupe error handlers

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Remove duplicate `srv.on("error")` handlers; prefer buffering error for `waitFor` failure messaging.
> 
> **Where**
> - `scripts/host_contracts_browser.mjs:63–65` (duplicate handlers).
>   
> **Affected Files**
> - [ ] `scripts/host_contracts_browser.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXIX] Static server: robust path traversal prevention

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Replace fragile string concatenation with `path.resolve` + `path.relative` check; decode URI before resolving.
> 
> **Where**
> - `scripts/serve-static.mjs` (request path resolution and 403 logic).
>   
> **Affected Files**
> - [ ] `scripts/serve-static.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXX] Browser contracts main: richer verifyIr diagnostics

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Change `verifyIr` to return `{ ok, errors, details? }` with descriptive messages; update callers to log context.
> 
> **Where**
> - `test/browser/contracts/main.js` (verifyIr function and usages).
>   
> **Affected Files**
> - [ ] `test/browser/contracts/main.js`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXXI] Preflight: remove redundant root package.json addition

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Delete `packageJsonPaths.add(resolve('package.json'))` duplication (already covered elsewhere).
> 
> **Where**
> - `scripts/preflight.mjs:145` (redundant add).
>   
> **Affected Files**
> - [ ] `scripts/preflight.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXXII] Static server: decode + normalize path joining

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Strip leading slash and decode URL before joining; ensure resolved path stays under root to avoid 403 loop.
> 
> **Where**
> - `scripts/serve-static.mjs` (path normalization before join/resolve).
>   
> **Affected Files**
> - [ ] `scripts/serve-static.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXXIII] Progress README: safe overall-marker replacement

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> After assembling `readmeAfterMatrix`, re‑locate `ovStart`/`ovEnd` and slice with updated indices before inserting the overall status.
> 
> **Where**
> - `scripts/compute-progress.mjs` (README marker replacement logic).
>   
> **Affected Files**
> - [ ] `scripts/compute-progress.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXXIV] Progress: guard network calls if fetch is absent

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> In `fetchMilestoneRatioFor`, check `typeof fetch === 'function'` in addition to token/repo presence to avoid ReferenceError.
> 
> **Where**
> - `scripts/compute-progress.mjs` (GitHub fetch helper).
>   
> **Affected Files**
> - [ ] `scripts/compute-progress.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXXV] Progress: tolerant nextStage() for unknown input

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Return a safe default (e.g., `'MVP'`) instead of throwing on unknown stages so README update doesn’t crash.
> 
> **Where**
> - `scripts/compute-progress.mjs` (`nextStage` implementation).
>   
> **Affected Files**
> - [ ] `scripts/compute-progress.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXXVI] CI: pin Bun version across workflows (dupe of XXIV)

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Ensure both `runtime-smokes.yml` and `pkg-host-bun.yml` use a fixed Bun version (e.g., `1.2.20`).
> 
> **Where**
> - `.github/workflows/runtime-smokes.yml` and `.github/workflows/pkg-host-bun.yml`.
>   
> **Affected Files**
> - [ ] `.github/workflows/runtime-smokes.yml`
> - [ ] `.github/workflows/pkg-host-bun.yml`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > Consolidates/duplicates item XXIV for clarity.  

## [XXXVII] Progress metadata: avoid volatile timestamps

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Stop committing volatile `generatedAt` timestamps; either git‑ignore `meta/progress.json` or replace with stable identifier (e.g., CI run SHA).
> 
> **Where**
> - `meta/progress.json` and `.gitignore`.
>   
> **Affected Files**
> - [ ] `meta/progress.json`
> - [ ] `.gitignore`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## [XXXVIII] Playwright installs: align version pinning and cache

> [!info] **Status**
>
> - [ ] Acknowledged
> - [ ] Resolved

> [!abstract]- 
> 
> **What**
> Align Playwright version pinning via a single `PLAYWRIGHT_VERSION` env var and ensure consistent browser cache location.
> 
> **Where**
> - `scripts/browser_smoke_playwright.mjs`
> - `scripts/host_contracts_browser.mjs`
>   
> **Affected Files**
> - [ ] `scripts/browser_smoke_playwright.mjs`
> - [ ] `scripts/host_contracts_browser.mjs`
>

> [!question]- **Outcome**
> - [ ] Issue resolved
> - [ ] Issue ignored
> - [ ] Issue remains unsolved
> 
> > [!note]- **NOTES**
> > {notes}  

## Follow-ups

- [x] Add a `--dry-run` flag to `scripts/compute-progress.mjs` to preview changes without writing files (helps testing). (commit `f1ec452a93f3`)
- [ ] Add a preflight check that validates all `requiredFor*` packages have explicit weights in `meta/progress.config.json` (fail early instead of relying on the 0.01 default).
- [ ] Document in README that local runs without `GITHUB_REPOSITORY` will show `—` for per-package CI badges.
 - [ ] Add a CI or pre-commit rule to prevent trailing double-space line breaks on README “Status:” lines (caught in VIII/IX).
 - [ ] Add `deno lint --unstable` to the `deno-smoke` job to catch unused `deno-lint-ignore-*` directives early (found in X).
 - [ ] Consider promoting `.github/actions/install-bats` to a reusable workflow callable across repos and pin package versions.
