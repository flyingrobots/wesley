# Contributing to Wesley

Wesley is a local-first system for planning, rehearsing, certifying, and
explaining semantic contract changes with durable compiler truth,
evidence-backed judgment, and explicit extension boundaries.

This repo now uses METHOD for workflow. Wesley's product doctrine remains
Wesley's. METHOD defines how work is queued, pulled, proved, and closed.

## Start Here

Read these surfaces in order:

- [README.md](README.md) for doctrine and repo shape
- [docs/BEARING.md](docs/BEARING.md) for current direction and tensions
- [docs/VISION.md](docs/VISION.md) for a bounded executive synthesis
- [docs/design/README.md](docs/design/README.md) for active design packets and boundary doctrine
- [docs/METHOD.md](docs/METHOD.md) for the workflow contract
- [docs/topics/contributing/triage.md](docs/topics/contributing/triage.md) for issue triage and release-lane scheduling
- [docs/governance/labels.md](docs/governance/labels.md) for issue and PR label semantics
- [AGENTS.md](AGENTS.md) for repository-specific automation rules

## Repository Doctrine

Wesley exists to make schema-authored semantic change trustworthy.

That means:

- GraphQL SDL is the source contract
- Wesley owns compiler truth, generic module contracts, and evidence plumbing
- external modules own target semantics, product behavior, runtime law, and
  database behavior
- runtime truth beats convenience
- evidence beats assertion
- replayability beats magic
- boring operator workflows beat impressive internals
- governed behavior beats advisory theater
- local-first operation beats unnecessary network dependence

Wesley is not a database product, runtime, scheduler, or hidden platform for
product policy. It is the semantic contract compiler and assurance toolchain;
the `GraphQL -> whatever` side must enter through explicit modules or owning
repos such as `wesley-postgres`.

## Repo Queue

GitHub owns live work state:

- GitHub Issues hold slices and raw intake.
- GitHub Milestones hold goalposts and release gates.
- GitHub Projects provide roadmap board views.
- GitHub labels carry triage state, release scheduling, legend, work-shape,
  and ownership metadata.

Repository files are the evidence ledger. Design packets, witnesses, retros,
release notes, and signpost docs record stable truth and proof after work is
done. The Chronicle files in the repo root are historical archive only.

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

1. Pull a GitHub Issue with the right goalpost milestone and either a
   `triage:*` intake label or concrete `vX.Y.Z` release label.
2. Add `work-in-progress` while the slice is active.
3. If the issue is still under `triage:*`, schedule it into a named release,
   split it, move it, or close it before implementation.
4. Write or update the design packet when the work needs durable design context.
5. Write failing tests from the playback questions or issue acceptance criteria.
6. Implement.
7. Produce a reproducible witness.
8. File follow-up work as GitHub Issues with the right goalpost and either a
   `triage:*` intake label or concrete release lane.
9. Update ship surfaces such as `docs/BEARING.md`, `CHANGELOG.md`, and release
   notes only from merged `main` state.

Review state rides on branches and PRs. GitHub Issues, Milestones, Projects, and
labels are the live queue.

## Wesley-Specific Closeout Rules

- Do not append new Chronicle entries. Close the loop in GitHub Issues, design
  packets, retros, witnesses, and signpost files instead.
- If docs contradict runtime behavior, fix the docs.
- If a claimed result cannot be reproduced from committed commands, tests,
  fixtures, or witness artifacts, it is not done.
- Keep generated runtime state in `.wesley-cache/`. It is output, not source.
- Respect `.llmignore`. It guards attention, not just tooling.

## Development Setup

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install
pnpm run bootstrap
```

## Package Manager And Lockfile Policy

`package.json` is the package-manager source of truth:
`"packageManager": "pnpm@9.15.9"`. Use Corepack to activate that exact pnpm
version before installing dependencies.

Wesley has one JavaScript lockfile: the root `pnpm-lock.yaml`. Do not commit
`package-lock.json`, `yarn.lock`, nested `pnpm-lock.yaml`, `bun.lock`,
`bun.lockb`, `deno.lock`, or `npm-shrinkwrap.json`. `cargo xtask
legacy-preflight` runs `scripts/check-package-manager-policy.mjs`, which checks
the pnpm version and tracked lockfile set before running package hygiene.

GitHub workflows and composite actions must install with
`pnpm install --frozen-lockfile` and immediately verify
`git diff --exit-code -- pnpm-lock.yaml`. Local commits use the tracked
`.githooks/pre-commit` hook: when staged `package.json` or
`pnpm-workspace.yaml` changes affect dependency resolution, it runs
`pnpm install --lockfile-only` and stages the updated `pnpm-lock.yaml`.

Useful commands:

```bash
pnpm lint
pnpm test
cargo xtask preflight
node scripts/pre-push-sanity.mjs --dry-run --files <changed-file> ...
cargo test -p wesley-core
cargo test -p wesley-cli
cargo wesley --help
```

For autonomous contributors, see [AGENTS.md](AGENTS.md).
