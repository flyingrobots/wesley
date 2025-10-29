# Roadmap (Now)

This page highlights the immediate focus areas. The living checklist is `go-public-checklist.md` at the repo root; the GitHub issues/projects referenced below track execution.

## In Flight

- `QIR Phase C` — `--ops` wiring, op→QIR translator, examples, EXPLAIN JSON snapshots, pgTAP smoke tests ([issues #160](https://github.com/flyingrobots/wesley/issues/160), [#159](https://github.com/flyingrobots/wesley/issues/159))
- `RLS defaults Phase 2` — Extend generated policies and pgTAP coverage ([issue #116](https://github.com/flyingrobots/wesley/issues/116))
- `Evidence & HOLMES` — Score refinements, schema hash emission, richer RLS composition ([issues #184](https://github.com/flyingrobots/wesley/issues/184), [#183](https://github.com/flyingrobots/wesley/issues/183))

## Next Up

- `CLI Resilience` — STDIN schema input, atomic writes, pgTAP runner ([issues #174](https://github.com/flyingrobots/wesley/issues/174)–[#176](https://github.com/flyingrobots/wesley/issues/176))
- `Core Quality Sweep` — SQL AST comparisons, test audits, architectural cleanup, JSDoc refresh ([issues #177](https://github.com/flyingrobots/wesley/issues/177)–[#180](https://github.com/flyingrobots/wesley/issues/180))
- `RPC Pipeline` — Composite params, SQL coverage, directive parsing, E2E tests ([issues #181](https://github.com/flyingrobots/wesley/issues/181)–[#185](https://github.com/flyingrobots/wesley/issues/185))
- `Scaffolds & Stacks (WIP)` — Multi-tenant templates and Supabase/Next.js stacks; see `group:frontend-adapters` + `group:devops-scaffolding` issues and mark milestones before public release.

## Governance

- Public readiness: README polish, required CI checks, branch protection hardening (tracked via `go-public-checklist.md`)

GitHub Projects:

- [Wesley Project Board](https://github.com/users/flyingrobots/projects/5)

See also: ../go-public-checklist.md
