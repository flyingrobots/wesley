# Repository Field Report

_Generated: 2025-10-21 (refreshed)_

## 1. First-Time Human Pass (New Developer)

**Score: 9/10** – The README now feels like a guided tour: quick start, scripts, tests, agent protocol, and evidence story are all surfaced. To hit 10/10, consider a short “start here” nav so newcomers aren’t overwhelmed by the detail.

### 1.1 Immediate Impressions

> [!success]
> The root `README.md` is opinionated and actionable, with copy-paste quick-start commands plus forward links to docs, scripts, tests, and operational guidance.

> [!success]
> `AGENTS.md` and the live Chronicle are linked from the README, so the contributor protocol is impossible to miss.

> [!warning]
> The README now doubles as a field manual; a concise TL;DR may help newcomers decide which sections to read first.

### 1.2 Documentation Flow

> [!success]
> `docs/README.md`, MkDocs, and the README’s deep links keep the documentation tree discoverable.

> [!success]
> Guides, fixtures, and CLI examples now reference the same paths (`test/fixtures/...`), eliminating earlier drift.

> [!success]
> Scripts, bootstrap, and test instructions are all linked—prerequisites are explicit.

### 1.3 Tooling & Local Setup

> [!success]
> `pnpm` remains front-and-center; `pnpm run bootstrap` codifies install → preflight → test.

> [!success]
> `scripts/preflight.mjs` + `.llmignore` + `meta/fixtures.json` give both humans and agents a deterministic footing.

> [!success]
> Cleanup tooling aligns with the new fixture layout—no stray generated directories linger.

### 1.4 Potential Confusions & Nice Touches

> [!warning]
> Workspace-level `node_modules/` directories still swell the repo; a CONTRIBUTING note could acknowledge the footprint.

> [!success]
> Chronicles, AGENTS, fixtures, and package READMEs form a cohesive story—hard to get lost once you know the map.

## 2. Root Directory Mini-Report

**Score: 9/10** – Root is now tidy (fixtures live under `test/fixtures`, `graphql/` removed, new meta/README breadcrumbs). Ongoing improvement: add a newcomer TL;DR to orient the eye.

| Path | Purpose & Contents | Newcomer Notes | Suggested Action |
| --- | --- | --- | --- |
| `docs/` | Architecture, guides, governance, MkDocs site. | README links straight to `docs/README.md`. | None. |
| `packages/` | Workspace packages for CLI/core/generators/etc. | Each package now ships a README. | Keep READMEs fresh as APIs evolve. |
| `test/` | Bats suites, fixtures, package harnesses. | New README explains commands, fixtures, CI. | None. |
| `scripts/` | Utility scripts (preflight, clean, hooks). | Documented via `scripts/README.md`. | None. |
| `schemas/` | JSON schemas for evidence/IR/directives. | README added and linked from root. | Maintain alongside schema changes. |
| `meta/` | Machine-readable fixtures manifest. | Useful for automation; currently advisory. | Consider enforcing via preflight. |
| `test/fixtures/` | Canonical fixtures (examples, blade, postgres, reference, RLS schema). | Every subdir now has a README. | None. |
| `CHRONICLES_….jsonl` | Agent activity log. | README points here explicitly. | None. |
| Root files (`AGENTS.md`, `CHANGELOG.md`, etc.) | Governance with agent protocol front-and-center. | None. | None. |

## 3. Repository Through an LLM Lens

**Score: 9/10** – Fixtures manifest, `.llmignore`, bootstrap command, and AGENTS appendix give agents clear guardrails. Remaining opportunity: enforce the manifest via preflight so it can’t silently drift.

> [!success]
> `meta/fixtures.json` enumerates canonical inputs for automation.

> [!success]
> `.llmignore` is documented in README/AGENTS, keeping token budgets sane.

> [!success]
> `pnpm run bootstrap` documents the exact sequence for first-class validation.

> [!warning]
> Manifest isn’t yet enforced—adding a preflight check would make it authoritative.

## 4. Packages Overview

**Score: 8.5/10** – Every package now has a README, and lingering tasklists moved to GitHub issues (#174–185). Remaining gap: WIP scaffolds/stacks still need roadmap milestones as the story firms up.

| Package | Snapshot | Expectations Met? | Opportunities |
| --- | --- | --- | --- |
| `@wesley/cli` | CLI entrypoint + Bats suites. | README covers commands/tests. | Keep README synced with CLI help output. |
| `@wesley/core` | Directive/IR/SQL engine. | README + follow-up issues. | Monitor issues #177–185. |
| `@wesley/generator-js` | JS/TS/Zod emitters. | README added; tests queued. | Track coverage in roadmap. |
| `@wesley/generator-supabase` | Supabase emitters/tests. | README documents `TestDepthStrategy`. | None. |
| `@wesley/holmes` | HOLMES/WATSON/MORIARTY tooling. | README plus README section in root. | Expand as scoring evolves. |
| `@wesley/host-node` | Node adapters + binary. | README added. | None. |
| `@wesley/scaffold-multitenant` | WIP scaffold templates. | README labels status. | Align roadmap/milestones. |
| `@wesley/slaps` | Lock-aware scheduling primitives. | README added. | None. |
| `@wesley/stack-supabase-nextjs` | WIP stack demo. | README labels status. | Align roadmap/milestones. |
| `@wesley/tasks` | Task orchestration utilities. | README added. | None. |

## 5. GitHub Meta Snapshot

**Score: 8.5/10** – Issue hygiene remains strong, and the Wesley project board now carries a description. Keep roadmap ↔ project ↔ README cross-links aligned as initiatives evolve.

> [!success]
> Issues are consistently labeled (`pkg:*`, `group:*`), keeping triage predictable.

> [!success]
> Wesley project board has a description; roadmap references active streams.

> [!warning]
> Continue cross-linking milestones for scaffold/stack work so WIP expectations are obvious to new contributors.

## 6. Recommendations (Checklist)

- [ ] Add a concise “start here” nav in README to help newcomers skim the essentials.
- [ ] Enforce `meta/fixtures.json` via preflight/lint so automation can rely on it.
- [ ] Keep scaffold/stack roadmap milestones/issues up to date as the WIP stabilises.
