# Repository Field Report

_Generated: 2025-10-21_

## 1. First-Time Human Pass (New Developer)

**Score: 8/10** – The onboarding story is compelling and the quick start works out of the box, but a few stray artifacts and hidden expectations could surprise fresh eyes. To reach 10/10, surface the agent protocol in the README and ensure generated leftovers (e.g., `demo/out/`) are cleaned or documented.

### 1.1 Immediate Impressions

> [!success]
> The root `README.md` is opinionated and actionable, pairing an elevator pitch with copy-paste quick-start commands and follow-up links.

> [!warning]
> `AGENTS.md` and the Chronicles log at the root are valuable but unreferenced by the README, so humans may miss their significance on the first pass.

> [!warning]
> A generated `demo/out/` directory lingers at the root, blurring the line between source and artifacts.

### 1.2 Documentation Flow

> [!success]
> `docs/README.md` acts as a curated map, and the live MkDocs site makes browsing painless.

> [!success]
> Guides (Quick Start, QIR, migrations) match the updated fixture paths, so docs and code stay in sync.

> [!warning]
> Core scripts like `pnpm run preflight` and `pnpm run clean` are discoverable in `scripts/`, but a README mention would help new contributors run the right commands first.

### 1.3 Tooling & Local Setup

> [!success]
> `pnpm` is clearly the package manager of record, pinned in both `package.json` and `pnpm-workspace.yaml`.

> [!success]
> `scripts/preflight.mjs` captures the repo hygiene bar and mirrors `.gitignore`, making CI parity straightforward.

> [!warning]
> `scripts/clean.mjs` now wipes fixture outputs but still leaves `demo/out/`; either explain the directory or fold it into the cleaner.

### 1.4 Potential Confusions & Nice Touches

> [!warning]
> `demo/` currently contains only generated SQL/tests; without context it reads like stale source.

> [!warning]
> Workspace-level `node_modules/` directories are expected but balloon repository size—worth a note in CONTRIBUTING for expectations.

> [!success]
> The Chronicles log plus `AGENTS.md` form a thoughtful process for autonomous contributors once discovered.

## 2. Root Directory Mini-Report

**Score: 7/10** – The directory structure is compact and purposeful, but a couple of folders (`demo/`, `graphql/`) could use inline context. Cleaning or documenting generated areas would bring this to 10/10.

| Path | Purpose & Contents | Newcomer Notes | Suggested Action |
| --- | --- | --- | --- |
| `docs/` | Authoritative documentation (architecture, guides, governance, MkDocs site). | Well-organized; `docs/README.md` provides a map. | Consider linking `docs/README.md` from root README. |
| `packages/` | Workspace packages for CLI, core, generators, adapters, demos. | Each package has code/tests; some lack package-level READMEs. | Add short package READMEs or doc links where missing. |
| `test/` | Top-level Bats suites, `fixtures/`, and package-specific helpers. | Fixtures now under `test/fixtures/…`—good consolidation. | Highlight fixtures path in README (already partially done). |
| `scripts/` | Utility scripts (`preflight`, `clean`, hooks). | Clear naming; mix of JS and Bash. | None. |
| `schemas/` | JSON/GraphQL schemas for evidence, IR, directives. | Acts as canonical schema store; documented indirectly. | Mention in README or docs as “source of truth” for schema assets. |
| `graphql/` | Canonical example `schema.graphql`. | Single entry point; helpful for readers. | Possibly add README clarifying difference from fixtures. |
| `demo/` | Currently only `out/` (generated SQL/tests). | Looks like stale output. | Add to cleaner or remove folder. |
| `docs/blade.md` & `test/fixtures/blade/` | Demo assets + narrative. | Paths now consistent (`out/blade`). | None. |
| `CHRONICLES_….jsonl` | Agent activity log. | Unique artifact; when noticed, adds clarity. | Mention in README? |
| Root files (`AGENTS.md`, `CHANGELOG.md`, etc.) | Governance & process docs. | Standard plus agent instructions. | None. |

## 3. Repository Through an LLM Lens

**Score: 7/10** – The repository is already automation-friendly, but a few metadata additions would smooth LLM workflows. Adding a fixtures manifest and a documented bootstrap path would push this toward 10/10.

> [!success]
> Machine-readable fixtures and schemas are already present, making deterministic analyses feasible.

> [!warning]
> Introduce a manifest (e.g., `meta/fixtures.json`) so agents can enumerate canonical inputs without bespoke path knowledge.

> [!warning]
> Package install → preflight → test into a documented bootstrap command so automated agents know the exact sequence.

> [!warning]
> Consider adding a `.llmignore` (in the spirit of `.gitignore`) to keep massive generated directories out of token windows.

## 4. Packages Overview

**Score: 6.5/10** – Code layout and testing are solid, but several packages lack README/context. Adding lightweight READMEs or doc links would raise this to 10/10.

| Package | Snapshot | Expectations Met? | Opportunities |
| --- | --- | --- | --- |
| `@wesley/cli` | Commander-based CLI; Bats tests under `test/`. | Yes—tests & CI docs present. | Provide package-level README to summarize commands (currently only CI/TASKLIST). |
| `@wesley/core` | Pure domain logic, rich test harness (`test/run-all-tests.mjs`). | Yes—well-documented internally. | Ensure `TASKLIST.md` stays current or move to issues/projects. |
| `@wesley/generator-js` | Emits JS models from IR. Minimal skeleton. | Mostly—code present, but no README/tests. | Add README + basic tests or TODO to roadmap. |
| `@wesley/generator-supabase` | Supabase-specific emitters with tests. | Yes. | Document `TestDepthStrategy.mjs` purpose. |
| `@wesley/holmes` | Evidence scoring CLI with tests. | Yes. | Could benefit from high-level README. |
| `@wesley/host-node` | Node adapters (`bin/wesley.mjs`, src, tests). | Yes. | No immediate gaps. |
| `@wesley/scaffold-multitenant` | Scaffolding templates (templates/). | Partially—templates exist, but README absent. |
| `@wesley/slaps` | SLAs & scoring package. | Minimal docs. | Add README describing SLAPS acronym/purpose. |
| `@wesley/stack-supabase-nextjs` | Starter stack scaffolding. | Contains `src/`; README missing. | Document usage or mark experimental. |
| `@wesley/tasks` | Task orchestration utilities with tests. | Looks complete. | No action. |

## 5. GitHub Meta Snapshot

**Score: 7.5/10** – Issue hygiene is strong and review load is light, but projects lack summaries. Adding project READMEs or cross-links from docs would make this a 10/10.

> [!success]
> Issues are consistently labeled (`pkg:*`, `group:*`), making triage predictable.

> [!success]
> Only one open PR (draft docs) suggests CI is stable and review queues are short.

> [!warning]
> GitHub Projects are active but have no descriptions; contributors must open the board to infer context.

## 6. Recommendations (Checklist)

- [ ] Add `demo/out/` (or the entire `demo/` folder) to `scripts/clean.mjs` and/or `.gitignore`, or document its purpose.
- [ ] Surface `AGENTS.md` (and the Chronicles concept) in `README.md` so newcomers know why the files exist.
- [ ] Create lightweight READMEs for packages lacking context (`generator-js`, `holmes`, `scaffold-multitenant`, `slaps`, `stack-supabase-nextjs`).
- [ ] Consider a machine-readable manifest for fixtures/schemas to aid automation and LLM agents.
- [ ] Optionally document `schemas/` in README or docs as the canonical schema repository.
- [ ] Attach short descriptions/readmes to GitHub Projects or link them from `docs/roadmap.md` for discoverability.
