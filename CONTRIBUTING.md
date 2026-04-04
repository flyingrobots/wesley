# Contributing to Wesley

Wesley is a local-first system for planning, rehearsing, certifying, and
explaining database change with durable runtime truth and evidence-backed
judgment.

This repo now uses METHOD for workflow. Wesley's product doctrine remains
Wesley's. METHOD defines how work is queued, pulled, proved, and closed.

## Start Here

Read these surfaces in order:

- [README.md](README.md) for doctrine and repo shape
- [docs/BEARING.md](docs/BEARING.md) for current direction and tensions
- [docs/VISION.md](docs/VISION.md) for a bounded executive synthesis
- [ROADMAP.md](ROADMAP.md) for Wesley V2 strategy and fixed contracts
- [docs/method/process.md](docs/method/process.md) for the workflow contract
- [docs/method/guide.md](docs/method/guide.md) for practical repo guidance
- [AGENTS.md](AGENTS.md) for repository-specific automation rules

## Product Doctrine

Wesley exists to make database change trustworthy.

That means:

- runtime truth beats convenience
- evidence beats assertion
- replayability beats magic
- boring operator workflows beat impressive internals
- governed behavior beats advisory theater
- local-first operation beats unnecessary network dependence

Wesley is not trying to be a clever compiler demo or a pile of abstractions
searching for a product. It is trying to become a trustworthy operating system
for schema change.

## Repo Queue

The queue is in the filesystem:

- `docs/method/backlog/` for queued work
- `docs/design/` for active cycle packets
- `docs/method/retro/` for closed cycle packets

The backlog names what should happen next. Retros, witnesses, and updated repo
surfaces record what was actually proved. The Chronicle files in the repo root
are historical archive only.

## Design Requirements

Every non-trivial cycle packet under `docs/design/<cycle>/` must name:

- sponsor human
- sponsor agent
- hill
- playback questions
- accessibility / assistive reading posture
- localization / directionality posture
- agent inspectability / explainability posture
- non-goals

If a posture is not relevant, say so explicitly. Silence is not a position.

Playback questions are the contract. Tests are the executable spec.

## Wesley Invariants

Wesley's standing invariants live under `docs/invariants/`:

- [schema-source-of-truth](docs/invariants/schema-source-of-truth.md)
- [ledger-truth](docs/invariants/ledger-truth.md)
- [evidence-truth](docs/invariants/evidence-truth.md)
- [provenance-visibility](docs/invariants/provenance-visibility.md)
- [local-first-operation](docs/invariants/local-first-operation.md)
- [governance-boundaries](docs/invariants/governance-boundaries.md)
- [docs-runtime-honesty](docs/invariants/docs-runtime-honesty.md)

Every cycle should preserve them. If a cycle changes one intentionally, name
that change explicitly in the design and witness.

## Legends

Wesley currently uses four METHOD legends:

- `SOURCE` for schema semantics, directives, parser/IR meaning, and ops
  contracts
- `TRANSMUTE` for transmutation declarations, generators, and output-domain
  expansion
- `RUNTIME` for lifecycle orchestration, run-model truth, hosts, and operator
  flows
- `EVIDENCE` for evidence maps, provenance, Holmes-family tools, certs, and
  judgment surfaces

See `docs/method/legends/` for the standing questions each legend owns.

## Default Loop

1. Pull a backlog item into `docs/design/<cycle>/`, or add a new backlog item
   first if the work emerged during the current cycle.
2. Write the design packet with the required METHOD fields.
3. Write failing tests from the playback questions.
4. Implement.
5. Produce a reproducible witness.
6. Close the cycle with a retro in `docs/method/retro/<cycle>/`.
7. Reconcile backlog lanes at cycle boundaries, not continuously.
8. Update ship surfaces such as `docs/BEARING.md`, `CHANGELOG.md`, and release
   notes only from merged `main` state.

Review state still rides on branches and PRs. METHOD does not pretend GitHub is
the queue.

## Wesley-Specific Closeout Rules

- Do not append new Chronicle entries. Close the loop in backlog, design,
  retro, witness, and signpost files instead.
- If docs contradict runtime behavior, fix the docs.
- If a claimed result cannot be reproduced from committed commands, tests,
  fixtures, or witness artifacts, it is not done.
- Keep generated runtime state in `.wesley-cache/`. It is output, not source.
- Respect `.llmignore`. It guards attention, not just tooling.

## Development Setup

```bash
pnpm install
pnpm run bootstrap
```

Useful commands:

```bash
pnpm lint
pnpm test
pnpm run preflight
node scripts/pre-push-sanity.mjs --dry-run --files <changed-file> ...
pnpm --filter @wesley/core test
pnpm --filter @wesley/cli test
node packages/wesley-host-node/bin/wesley.mjs --help
```

For autonomous contributors, see [AGENTS.md](AGENTS.md).
