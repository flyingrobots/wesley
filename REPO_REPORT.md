# Repository Field Report

_Generated: 2025-10-21_

## 1. First-Time Human Pass (New Developer)

### 1.1 Immediate Impressions
- The root `README.md` is thorough and opinionated. It gives a solid elevator pitch, a copy-paste local quick start, and clear “where to go next” pointers.
- The presence of `AGENTS.md` and the Chronicles file at the root is unusual but well-signposted; the README doesn’t mention them directly, so newcomers may miss their significance unless they explore.
- Folders are few and descriptive (`docs/`, `packages/`, `test/`, etc.), but a generated `demo/out/` directory lingers and could confuse someone skimming for source vs. artifacts.

### 1.2 Documentation Flow
- `docs/README.md` provides a curated map of the documentation site. The `mkdocs.yml` at the root makes it easy to discover http://flyingrobots.github.io/wesley/.
- Guides are split sensibly between architecture, internals, and task-oriented guides. The recently relocated fixtures referenced in the README (`test/fixtures/examples/…`) line up with docs.
- For hands-on learning, the README links to the BLADE demo and the lifecycle doc. It may still help to surface `pnpm run preflight` or `pnpm run clean` in the README so new contributors know the repo-specific commands exist.

### 1.3 Tooling & Local Setup
- `pnpm` is clearly the package manager of record (pinned in `package.json` and `pnpm-workspace.yaml`).
- `scripts/preflight.mjs` codifies hygiene checks. The script expects `.gitignore` entries for fixtures and outputs, which matches the current layout.
- `scripts/clean.mjs` now wipes the relocated fixture outputs but not `demo/out/`. Either add that directory to the cleaner or document it as intentionally persistent.

### 1.4 Potential Confusions & Nice Touches
- `demo/` only contains generated `out/` files; a README or removal of the directory would reduce ambiguity.
- `node_modules/` exists both at root and in every package (typical for workspaces, but worth noting for repo size).
- `CHRONICLES_OF_THE_MACHINE-KIND_VOL_00000001.jsonl` and `AGENTS.md` set expectations for autonomous contributors—a cool feature, but humans may skim past them unless we call them out in the README.

## 2. Root Directory Mini-Report

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

- **Determinism & Metadata:** The repo already provides machine-friendly fixtures and schemas. Consider adding a machine-readable manifest (e.g., `meta/fixtures.json`) mapping logical names to paths so automations can discover test inputs without hardcoded strings.
- **Automation Hooks:** `scripts/preflight.mjs` and `pnpm run clean` are great entry points. Packaging them into a single “bootstrap” script (`pnpm run setup`) could help automated agents know the exact sequence (install → preflight → test).
- **Context Surfaces:** The agent guidance (`AGENTS.md`) is gold. Linking it from `README.md` would ensure both humans and bots see it upfront. For LLMs with limited token windows, a short `CONTRIBUTING_SUMMARY.md` might help.
- **Large Trees:** Each package has its own `node_modules/`, which can balloon tokens when crawled blindly. A `.llmignore` (similar to `.gitignore`) listing generated directories could help future automation tools.

## 4. Packages Overview

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

- **Issues:** 20 recent open issues skew toward enhancements (CLI, generators) and demos. Labels are consistent (`pkg:*`, `group:*`). No critical bugs flagged.
- **Pull Requests:** Only PR #109 is open (draft docs on QIR). CI likely stable.
- **Projects:** Two public projects (Wesley #5 with 64 items, db8 Roadmap #3 with 87 items). Both appear active; no README attached, so contributors must inspect columns manually.

## 6. Recommendations (Checklist)

- [ ] Add `demo/out/` (or the entire `demo/` folder) to `scripts/clean.mjs` and/or `.gitignore`, or document its purpose.
- [ ] Surface `AGENTS.md` (and the Chronicles concept) in `README.md` so newcomers know why the files exist.
- [ ] Create lightweight READMEs for packages lacking context (`generator-js`, `holmes`, `scaffold-multitenant`, `slaps`, `stack-supabase-nextjs`).
- [ ] Consider a machine-readable manifest for fixtures/schemas to aid automation and LLM agents.
- [ ] Optionally document `schemas/` in README or docs as the canonical schema repository.
- [ ] Attach short descriptions/readmes to GitHub Projects or link them from `docs/roadmap.md` for discoverability.

