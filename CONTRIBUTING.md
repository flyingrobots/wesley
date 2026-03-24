# Contributing to Wesley

Wesley is a local-first system for planning, rehearsing, certifying, and
explaining database change with durable runtime truth and evidence-backed
judgment.

If you contribute here, the job is not just to land working code. The job is to
protect Wesley's product doctrine while making the system more capable, more
truthful, and easier to operate.

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

## Current Active Plan

The strategic roadmap of record is [ROADMAP.md](ROADMAP.md).

Wesley is currently working across two adjacent roadmap phases:

- **Late Phase 2: Make It Durable**
  - one real run model
  - ledger-backed inspection, replay, doctor, and resume
  - `plan`, `rehearse`, `certify`, and `moriarty` moving onto the same runtime
    truth
- **Active Phase 3: Make It Truthful**
  - exact evidence spans
  - evidence trust surfaced in HOLMES, WATSON, MORIARTY, and certs
  - placeholder bundle and score synthesis being removed from real paths
  - docs and runtime being forced to describe what is actually true

Current emphasis:

- remove remaining fake or provisional evidence paths
- make HOLMES, WATSON, and MORIARTY operate on increasingly truthful runtime
  inputs
- continue architectural cleanup only where it directly improves truth,
  durability, or operator clarity

## Product Management Philosophy

Wesley uses an IBM Design Thinking-style framing adapted to the repo's actual
invariants.

Every non-trivial cycle should define:

- sponsor actors
- hill
- playback
- invariants
- non-goals

### Sponsor Actors

A sponsor actor is the person or agent whose job should get easier.

Common Wesley sponsor actors include:

- the platform engineer shipping risky schema changes
- the application engineer evolving a schema safely
- the reviewer deciding whether a change is trustworthy
- the release owner recovering a failed run
- the agent consuming runtime truth to explain or predict behavior

### Hills

A hill is the user-relevant outcome, not the implementation detail.

Good hill:

- "A release owner can resume a failed run and produce a trustworthy
  certificate without manual cleanup."

Bad hill:

- "Add event-store snapshots."

### Playbacks

A playback is the concrete demonstration that proves the hill is real.

Good playback:

- `wesley blade --resume --counterfactual main` on an injected crash, ending in
  a certificate with exact evidence and a clear gate decision

If a cycle cannot be demonstrated through a meaningful playback, the cycle is
probably not framed well enough.

### Invariants

Every cycle must preserve Wesley's core invariants:

- ledger truth
- evidence truth
- provenance visibility
- local-first operation
- explicit governance boundaries
- no docs/runtime dishonesty

### Non-Goals

Every cycle should say what it is not trying to solve. This is how Wesley
avoids accidental scope sprawl disguised as "just one more cleanup."

## Development Philosophy

This project prefers:

- DX over ceremony
- behavior over architecture theater
- explicit boundaries over clever coupling
- local-first operation over network dependency
- boring default flows over impressive internals
- explicit semantics at governance boundaries

In practice, that means:

- keep commands and pages small and obvious
- keep default UX boring and legible
- keep product language free of unnecessary Git or git-warp jargon
- keep AI advisory until it is explicitly adopted into governed work
- keep UI and CLI behavior honest to the same graph truth
- do not present proposed behavior as if it is already shipped

## Architectural Principles

### Hexagonal Architecture

Wesley should have clear boundaries between:

- domain behavior
- application and use-case orchestration
- ingress adapters such as CLI and TUI
- infrastructure such as filesystem, git-warp persistence, clocks, process I/O,
  and synchronization

Rules:

- do not let UI concerns leak into persistence
- do not let storage details leak into normal UX
- do not let one CLI shell out to another CLI when a shared use case or port
  should exist
- do not let Node-specific orchestration live in core
- do not let core depend on ambient globals, process-wide state, or wall-clock
  behavior

### Do Not Reproduce Supporting Library Features

Wesley may consume supporting libraries. It should not casually reimplement
them.

In particular:

- git-warp is substrate, not product doctrine
- Wesley may consume git-warp facts, comparisons, transfer plans, and
  working-set capabilities
- Wesley should not grow its own parallel git-warp inside product code
- adapter code may map substrate behavior into Wesley-native reports
- product judgment, governance, readiness, and certification belong to Wesley,
  not to the substrate

### SOLID, Pragmatically Applied

Use SOLID as boundary discipline, not as a reason to create needless
abstractions.

Good:

- narrow modules
- explicit seams
- dependency inversion around important adapters
- extracting logic when duplication or environment coupling becomes real
- pure functions for forecast math, reducers, and classification

Bad:

- abstraction for its own sake
- indirection before there is real pressure
- "clean architecture" rituals that slow delivery without protecting behavior
- turning one file into twelve files with no meaningful reduction in coupling

## Development Cycle Loop

For bounded product or debt work, the default loop is:

1. define the hill
2. write or revise the design doc
3. write acceptance tests as the behavioral spec
4. implement
5. run playback
6. retrospective and closeout
7. reconcile backlog before the next cycle begins

The slice is not done because code landed and tests pass. It is done when:

- the sponsor actor can do their job better
- the behavior is captured in executable tests
- the relevant docs reflect reality
- the playback proves the value
- the backlog is reconciled before the next cycle begins

## Tests Are The Spec

Wesley follows a hard rule:

- design docs define intent and invariants
- executable tests define the behavioral spec
- implementation follows

There is no second prose-spec layer between design docs and tests.

For cycle-scale behavior:

- acceptance tests live under `test/acceptance/`
- reusable fixtures live under `test/fixtures/`
- lower-level unit and integration tests remain organized by architecture

Until that hierarchy is fully in place, existing unit and integration tests
remain valid. New cycle-level behavior should move toward the acceptance
hierarchy.

Tests should pin:

- user-visible behavior
- governance semantics
- provenance visibility
- machine-readable agent behavior
- substrate/application boundary honesty

Tests should not overfit:

- class layout
- helper names
- incidental file structure
- private implementation details

## Slice Taxonomy

Every slice should be classified as one of:

- `product`
- `integrity`
- `enabler`

Definitions:

- `product`: directly improves a sponsor actor's experience or outcome
- `integrity`: removes lies, drift, flake, or trust debt
- `enabler`: creates capability needed for a later product slice

Rules:

- every `integrity` or `enabler` slice should name the hill it serves
- if it cannot name a hill, it probably belongs in backlog
- do not confuse infrastructure motion with product progress

## Cycle Control Rules

The hill is fixed once the cycle starts.

Allowed changes during a cycle:

- adjusting implementation slices
- refining tests
- simplifying the route to the hill
- cutting non-essential work

Not allowed during a cycle:

- silently changing the hill
- smuggling in unrelated cleanup
- broadening scope because the code nearby looks ugly
- treating newly discovered work as part of the current cycle unless it is
  required to achieve the hill

If new useful work appears and is not necessary for the current hill:

- backlog it
- finish the cycle
- reconcile afterward

If a cycle becomes blocked in a way that invalidates the hill:

- stop
- get the branch into a committable state
- record the failure and retrospective
- reconcile the backlog
- start a new cycle intentionally

## Project Planning

Project planning and task tracking live in GitHub Issues and Milestones.

Default execution flow:

1. identify or create the issue
2. frame the work around a sponsor actor and hill
3. claim the work
4. implement on a feature branch unless an explicit repo workflow says
   otherwise
5. submit for review
6. resolve feedback completely
7. merge only when the relevant gates are green

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
```

Recommended runtime:

- Node 22+
- pnpm workspace tooling

## Quality Gates

Never push code that does not pass the relevant local checks and CI.

Rules:

- do not use `--no-verify`
- do not silence lint with `eslint-disable` unless the rule itself is wrong and
  the change is justified
- do not use `@ts-ignore` or `@ts-expect-error` as convenience escape hatches
- if you touch flaky or dishonest code, prefer leaving it better than you found
  it

Wesley's local discipline includes:

- preflight checks
- smart pre-push sanity checks selected by changed files
- deterministic test expectations
- docs-truth validation
- docs-link validation

## Testing Rules

Tests must be deterministic.

That means:

- no real network dependency in the core suite
- no ambient home-directory state assumptions
- no ambient Git config assumptions
- no interactive shell expectations
- no timing-based flakes

Prefer:

- fake clocks
- seeded randomness
- isolated temp state
- fixed env and fixed IDs where practical
- scenarios that pin user-visible behavior

## Documentation Discipline

If a design doc contradicts reality, the doc is wrong.

Documentation responsibilities:

- update the canonical docs touched by the cycle
- update the root README when the project front door or product story changes
- do not let examples imply behavior that is not shipped
- do not let old architecture survive as unmarked truth after it has been
  replaced

## Git Workflow

Prefer small, honest commits.

Rules:

- use additive commits
- do not casually rewrite shared history
- prefer merges over rebases for shared collaboration
- do not force git operations
- do not amend commits after publication
- make the history trustworthy, not ornamental

## Release Discipline

Milestone closure and release discipline are coupled.

Rules:

- keep the root [CHANGELOG.md](CHANGELOG.md) current
- when a milestone closes and produces a release, bump package versions on the
  release commit
- create a Git tag on the `main` commit that lands that release
- let versioning reflect milestone reality, not aspirational scope

## Questions

Open a GitHub issue for product or workflow questions. For private conduct or
security concerns, use the contact paths documented elsewhere in the repo.
