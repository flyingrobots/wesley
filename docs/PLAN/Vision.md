Wesley — Vision & Plan (Set In Stone)

TL;DR: Wesley is the schema→system brain. It compiles GraphQL (+ Wesley directives) to deterministic artifacts, plans zero-downtime changes, and runs its own plans with receipts. One blessed stack now (Supabase + Next.js). Everything else waits.

⸻

The Vision

12 months — The Declarative Supabase Standard
	•	Product: GraphQL (+ directives) → IR → SQL/RLS/migrations + JS+Zod → Plan → Runner → Certificate.
	•	Scope: One stack (supabase-nextjs). 1–3 Packs (multi-tenant, marketplace-lite, analytics-lite).
	•	Guarantees: Zero-downtime patterns, drift detection, pgTAP proof, idempotent re-runs.
	•	Reputation: “If you’re building SaaS on Supabase, you use Wesley.”

24 months — Two Stacks, Same Guarantees
	•	Second stack (community-led, e.g., Postgres+Django or PlanetScale+Astro).
	•	Runner maturity: broader Postgres step coverage; explicit “unsafe with flag” flows.
	•	Advisor (opt-in): suggests Packs from IR signals; never writes without approval.
	•	Registry: signed Packs/Stacks with versions.

5 years — The Data-Plane Contract
	•	De facto contract for describing + evolving data planes across ecosystems.
	•	Core stays lean: IR, Planner, Runner. The world builds Packs/Generators around it.

Wesley is
	•	Compiler → Planner → Runner (for Wesley plans only).
	•	Extensible by Scaffolds (what), Stacks (how), Generators (tech).
	•	Provable (pgTAP + migration Certificate).

Wesley is not
	•	Not a generic SQL runner, ORM, GUI builder, or “make any app” toy.
	•	Not replacing GraphQL with X. (Other inputs may compile to the IR later.)
	•	Not payments/identity. We emit glue; we aren’t Stripe/Auth0.

⸻

Where We Are Today
	•	Boundaries blurred: CLI logic and Node imports leaked into wesley-core.
	•	Nested git mishap: re-exposed files, created conflicting CLI frameworks.
	•	Scaffolds in core: multi-tenant.graphql lives where it shouldn’t.
	•	Generation already a DAG: dependencies exist but no unified engine.
	•	Good news: Architecture direction is clear; we have the parts.

⸻

Where We’re Going Next (Target Topology)

packages/
  wesley-core/                 # PURE: GraphQL → IR (+ directive semantics, ports)
  wesley-cli/                  # PURE: commands + main(argv, adapters)
  wesley-host-node/            # Node adapters (fs/env/logger/stdin) + tiny bin
  wesley-generator-supabase/   # SQL/RLS/migrations/pgTAP emitters
  wesley-generator-js/         # JS + JSDoc + Zod emitters
  wesley-scaffold-multitenant/ # 300+ line GraphQL scaffold (+ docs/tests)
  wesley-stack-supabase-nextjs/# Recipe manifest that wires generators
  wesley-tasks/                # Planner: DAG builder/toposort/hashes (generic)
  wesley-slaps/                # Runner: executor/journal/retries (generic)
  # (later) wesley-runner-pg/  # Postgres step handlers (locks, NOT VALID, etc.)

One engine for both worlds:
	•	TASKS plans DAGs for generation and migrations.
	•	SLAPS executes with journaling, idempotency, and resource gates.

⸻

Immediate Steps Required to Reorganize the Repo (and Why)
	1.	Evict CLI & Node from core (non-negotiable)
	•	Why: Core must be portable and testable; no fs/path/url/process or shebangs.
	•	Remove packages/wesley-core/src/cli/** and src/commands/**.
	2.	Make CLI thin & pure; host owns the platform
	•	@wesley/cli: main(argv, adapters) (no process/fs).
	•	@wesley/host-node: adapters + bin/wesley.mjs that calls cli/main.
	3.	Extract the scaffold out of core
	•	Move multi-tenant.graphql to @wesley/scaffold-multitenant/ with README + tests.
	4.	Introduce the stack recipe
	•	@wesley/stack-supabase-nextjs/recipe.json lists generator steps for the scaffold.
	5.	Normalize generators as pure emitters
	•	No Node imports. Accept ports (logger/clock/random/sinks).
	6.	Add TASKS/SLAPS packages
	•	@wesley/tasks: Plan JSON, node hashes, topo order.
	•	@wesley/slaps: Executes nodes with journal + resource gates (e.g., db:postgres, fs:outdir).
	7.	Lock public surfaces with exports
	•	Every package exports only its intended API; kill deep ./src/* imports.
	8.	Kill nested-git and block regressions
	•	Remove stray .git dirs; add a pre-commit/CI script to fail if any are reintroduced.
	9.	Install the boundary police
	•	dependency-cruiser rule “No Node in core,” “No CLI in core.”
	•	ESLint no-restricted-imports blocking node:* in core.
	10.	Golden E2E

	•	Run generate twice → no diff.
	•	Add pgTAP run + certificate emission (IR hash, plan hash, server fingerprint).

After these steps, you have hard seams: core is sacred; CLI thin; scaffolds/stacks/generators modular; planner/runner generic.

⸻

What To Do Once Refactoring Is Complete

1) Freeze the contract
	•	IR_SPEC.md v0.1 (with a stability index).
	•	VISION.md (this doc’s “Is/Is-Not” + 12/24/60-month goals).
	•	ARCHITECTURE.md (ports/adapters diagram, TASKS/SLAPS flow).
	•	CONTRIBUTING.md (zones: RED/AMBER/GREEN; tests & docs required).

2) Governance that scales you
	•	CODEOWNERS: you own RED (core/IR/planner/runner).
	•	Protected branches + required checks: dep-cruise, ESLint, E2E snapshot, pgTAP.
	•	RFCs/WEPs: any RED change requires a proposal (Motivation → IR impact → Safety → Back-compat → Revert plan).

3) Productize the demo
	•	Scripted runbook + 90-second screencast:
	1.	wesley analyze
	2.	wesley generate
	3.	wesley plan
	4.	wesley migrate up
	5.	pgTAP proof + Certificate printout
	•	Publish the hello SaaS repo (Next.js minimal UI) powered by generated artifacts.

4) Open safe lanes for contributors
	•	Label 8–12 GREEN issues (Packs, docs, pgTAP cases, examples).
	•	Starter kits: “Write a Pack,” “Add a generator,” “Extend pgTAP tests.”
	•	Canned replies for out-of-scope asks (VS Code, alt schema languages, second stacks).

5) Roadmap to v0.2 / v1.0
	•	v0.2: expand Postgres step handlers; add Marketplace-lite Pack; Advisor (read-only).
	•	v1.0 (12 mo): IR freeze, runner coverage complete for common ops, signed Pack/Stack registry; consider second stack.

⸻

Appendices (drop-in snippets)

dependency-cruiser

// .dependency-cruiser.js
module.exports = {
  forbidden: [
    { name:"no-node-in-core",
      from:{ path: "^packages/wesley-core/src" },
      to:{ path: "node_modules/(fs|path|url)|^node:" }, severity:"error" },
    { name:"no-cli-in-core",
      from:{ path: "^packages/wesley-core" },
      to:{ path: "^packages/wesley-(cli|host-node)" }, severity:"error" }
  ]
};

ESLint restriction

// .eslintrc.cjs
module.exports = {
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{ group: ["node:*","fs","path","url","process"], message: "No Node in core." }]
    }]
  }
}

Nested-git guard

# scripts/check-no-nested-git.sh
if find . -type d -name .git ! -path "./.git" | grep -q .; then
  echo "Nested .git repo detected"; exit 1; fi

CODEOWNERS

packages/wesley-core/**                 @flyingrobots
packages/wesley-tasks/**                @flyingrobots
packages/wesley-slaps/**                @flyingrobots
packages/wesley-generator-*/**          @flyingrobots
packages/wesley-stack-*/**              @flyingrobots
IR_SPEC.md                              @flyingrobots

Stack recipe (minimal)

{
  "name": "@wesley/stack-supabase-nextjs",
  "recipes": {
    "multitenant": [
      { "use": "@wesley/generator-supabase", "with": ["ddl","rls","indexes","pgtap"] },
      { "use": "@wesley/generator-js", "with": ["models","zod","next-api:/api/*"] }
    ]
  }
}


⸻

Final Word

Ambition is not your enemy; entropy is. This locks the shape:
	•	Core is a contract.
	•	Plans are immutable.
	•	Runner is scoped.
	•	One stack, one unforgettable demo.

Ship this spine, then let the world safely color inside your lines.


---

Absolutely. Here’s the definitive package-by-package guide—with what goes inside, what it may (and may not) depend on, how it talks to the rest, and a blunt “where does this go?” placement cheat-sheet.

Wesley Monorepo Blueprint

Legend
	•	PURE = no Node APIs, no platform I/O; isomorphic ESM only.
	•	NODE = may use Node APIs, env, filesystem, network.
	•	RED = sealed/core; AMBER = reviewed; GREEN = community surface.

⸻

1) @wesley/core — GraphQL → IR (PURE, RED)

Job: Parse GraphQL (+ Wesley directives) → IR. Define ports (interfaces) used by others. Zero I/O.

Public API (exports)
	•	parseSchema(sdl: string): SchemaAst
	•	buildIR(ast | sdl: string): IR
	•	types/ (IR types, Directive specs)
	•	ports/ (LoggerPort, FileSystemPort, ClockPort, RandomPort, DbPort interfaces only)

Internal layout

src/
  domain/             # IR models, helpers (pure)
  directives/         # directive semantics
  parsers/            # SDL → AST → IR
  ports/              # Type-only interfaces
  errors/             # Error types (no Node)

Allowed external deps
	•	graphql (AST only), @noble/hashes (if you need a pure hash), tiny utility libs (must be isomorphic).
Forbidden
	•	node:*, fs, path, process, DB drivers, logging libs.

Talks to
	•	Nobody directly; others call it.

⸻

2) @wesley/cli — Commands + main() (PURE, AMBER)

Job: Glue argv → config → core/generators/tasks/slaps. No Node APIs.

Public API
	•	main(argv: string[], adapters: CLIAdapters): Promise<number>
	•	commands/ (thin: generate, plan, migrate, analyze)

Internal layout

src/
  main.mjs            # entry (pure)
  program.mjs         # command registration (pure)
  commands/
    generate.mjs      # calls tasks/slaps + generators
    plan.mjs          # builds migration plan via tasks
    migrate.mjs       # delegates execution to slaps + runner
    analyze.mjs
  framework/
    utils.mjs         # formatError/exitCode/resolveLevel (pure)

Allowed external deps
	•	None required. If you must, isomorphic parsers only.
Forbidden
	•	process, fs, node:*. All platform concerns come from adapters passed by host-node.

Talks to
	•	@wesley/core, @wesley/tasks, @wesley/slaps, generators, stacks (via file manifests), adapters from host-node.

⸻

3) @wesley/host-node — Adapters + Bin (NODE, AMBER)

Job: Own the platform. Provide Node-specific adapters and the CLI binary.

Public API
	•	adapters (parseArgs, logger, fs, env, stdin, timers)
	•	bin/wesley.mjs (#!/usr/bin/env node → calls @wesley/cli/main)

Internal layout

src/
  adapters.mjs        # parseArgs, logger (pino|console), fs, env, stdin
  pg-adapter.mjs      # (later) db connection factory for runner-pg
bin/
  wesley.mjs          # tiny: main(argv, adapters)

Allowed external deps
	•	yargs-parser (or equivalent), pino (optional), pg (later, for runner), fast-glob (optional).
Forbidden
	•	Exporting deep internals to other packages; keep a tight exports.

Talks to
	•	Calls @wesley/cli/main. Supplies adapters to CLI & runner.

⸻

4) @wesley/generator-supabase — SQL/RLS/Migrations/pgTAP (PURE, AMBER)

Job: Turn IR into SQL DDL, RLS policies, phased migration fragments, and pgTAP tests. No Node APIs.

Public API
	•	emitDDL(ir): ArtifactSet
	•	emitRLS(ir): ArtifactSet
	•	emitMigrations(ir): ArtifactSet
	•	emitPgTap(ir): ArtifactSet

Internal layout

src/
  emitters/
    ddl.mjs
    rls.mjs
    migrations.mjs
    pgtap.mjs
  templates/          # tiny SQL fragments

Allowed external deps
	•	None (prefer template strings). If you must, small pure libs only.
Forbidden
	•	node:*, DB drivers, filesystem.

Talks to
	•	Called by CLI pipelines (via tasks/slaps). Outputs go to write_files handler (not here).

⸻

5) @wesley/generator-js — JS + JSDoc + Zod + Next API stubs (PURE, GREEN/AMBER)

Job: Generate JS models, Zod validators, minimal Next.js API route stubs (pure strings/templates).

Public API
	•	emitModels(ir): ArtifactSet
	•	emitZod(ir): ArtifactSet
	•	emitNextApi(ir, pattern = "/api/*"): ArtifactSet

Internal

src/
  models.mjs
  zod.mjs
  next-api.mjs
  templates/

Allowed external deps
	•	None required.
Forbidden
	•	Node APIs; writing files (that’s the pipeline’s job).

Talks to
	•	Called by CLI pipelines (via tasks/slaps).

⸻

6) @wesley-scaffold-multitenant — Schema (PURE, GREEN)

Job: Provide a ready-to-use GraphQL schema. That’s it.

Public API
	•	schema.graphql
	•	README.md, usage notes, tests that snapshot generated outputs.

Deps
	•	None.

Talks to
	•	Consumed by wesley generate / stack recipe.

⸻

7) @wesley-stack-supabase-nextjs — Recipe Manifest (PURE, AMBER)

Job: Describe how to realize a scaffold with specific generators.

Public API
	•	recipe.json

{
  "recipes": {
    "multitenant": [
      { "use": "@wesley/generator-supabase", "with": ["ddl","rls","migrations","pgtap"] },
      { "use": "@wesley/generator-js", "with": ["models","zod","next-api:/api/*"] }
    ]
  }
}



Deps
	•	None (data-only).

Talks to
	•	CLI pipelines read this manifest to build the TASKS DAG.

⸻

8) @wesley/tasks — Planner/DAG (PURE, RED)

Job: Build/validate a DAG of operations for generation and migrations; compute stable node hashes.

Public API
	•	buildPlan(nodes, edges, context): Plan
	•	order(plan): Stage[] (toposort + resource gates)
	•	diff(prev, next): PlanDiff (later)

Internal layout

src/
  hash.mjs            # pure hash via @noble/hashes
  validate.mjs        # DAG validation
  topo.mjs            # ordering
  plan.mjs            # types + builders

Allowed external deps
	•	@noble/hashes (pure).
Forbidden
	•	Node APIs, filesystem.

Talks to
	•	Consumed by CLI to create a plan; consumed by SLAPS to execute.

⸻

9) @wesley/slaps — Runner/Executor (PURE, RED)

Job: Execute a Plan with journaling + retries + resource gating. Handlers injected.

Public API
	•	run(plan, { handlers, journal, logger, concurrency? })
	•	Handler shape: (node, ctx) => Promise<{ outputs?, ok? }>
	•	Journal port: { read(key), write(key, record) }

Internal layout

src/
  run.mjs
  stages.mjs
  journal-api.mjs     # interface docs
  policy.mjs          # backoff/retry defaults

Allowed external deps
	•	None.
Forbidden
	•	Node APIs. Real I/O is inside injected handlers or the host’s journal impl.

Talks to
	•	Handlers provided by CLI (generation) or by runner-pg (DB).

⸻

10) (Later) @wesley/runner-pg — Postgres Step Handlers (NODE, RED/AMBER)

Job: Implement DB steps: locks, timeouts, NOT VALID → VALIDATE, chunked backfills, pgTAP run.

Public API
	•	handlers = { create_index_concurrently, add_column_nullable, backfill_sql, set_not_null, add_constraint_not_valid, validate_constraint, pgtap_run }
	•	Requires a DbAdapter from host-node.

Allowed external deps
	•	pg, pg-format (optional), small helpers.

Forbidden
	•	Reaching into core/generators directly (take IR-derived SQL from plan).

Talks to
	•	@wesley/host-node (to get DB connection factory), used by SLAPS to run nodes with resources:["db:postgres"].

⸻

How Packages Talk (at a glance)

        +----------------+
        |  wesley-core  |  (PURE, IR)
        +--------+------+
                 ^
                 |
        +--------+--------+           +---------------------------+
        |     wesley-cli  | --------> | wesley-tasks (plan/DAG)   |
        |  (argv→ports)   |           +------------+--------------+
        +--------+--------+                        |
                 |                                 v
                 |                       +---------+----------+
                 |                       | wesley-slaps       |
                 |                       | (run plan)         |
                 |                       +--+--------------+--+
                 |                          |              |
        +--------+--------+                 |              |
        | wesley-host-node| (adapters)      |              |
        +--------+--------+                 |              |
                 |                          |              |
     +-----------+------+           +------+--+    +-------+------------------+
     | generators-supabase|         |gen-js  |    | (later) runner-pg (DB IO) |
     +--------------------+         +--------+    +----------------------------+

	•	CLI builds a plan via TASKS (using core IR & stack recipe), then executes via SLAPS.
	•	Generation handlers live in CLI-land (pure); DB handlers live in runner-pg (Node), gated by resources:["db:postgres"].
	•	host-node injects adapters (args, fs, logger, db client) into CLI & runner.

⸻

“Where does this go?” — Placement Guide

Use this like a bouncer at 2am. If it fails any rule, it doesn’t get in.

A) Input/Parsing/IR
	•	GraphQL SDL / directives → IR logic? → @wesley/core.
	•	Changing IR shape/types? → @wesley/core (+ RFC if public).

B) Code/Artifact Generation
	•	Emit SQL/RLS/migrations/pgTAP? → @wesley/generator-supabase.
	•	Emit JS models/Zod/Next API stubs? → @wesley/generator-js.
	•	Write files to disk? → nowhere; that’s a pipeline handler in CLI using SLAPS.

C) Orchestration
	•	DAG building/toposort/hashes? → @wesley/tasks.
	•	Executing steps/journaling/retries? → @wesley/slaps.
	•	DB step implementations (locks/backfill/validate)? → @wesley/runner-pg (later).

D) Platform/Runtime
	•	Process args, env, fs, stdout, timers? → @wesley/host-node.
	•	CLI UX / commands / main()? → @wesley/cli.

E) Domain Templates
	•	Scaffold schemas (blog, multi-tenant, marketplace-lite)? → @wesley-scaffold-*.

F) Realization Recipes
	•	Mapping a scaffold to generators for a stack? → @wesley-stack-* (manifest only).

G) Absolutely Not In Core
	•	Any #!/usr/bin/env node, node:*, fs, process, db connections, Next.js specifics, file writing, logging libs. Those live in host/generators/runner respectively.

⸻

External Dependency Map (approved sources)

Package	Allowed externals (examples)	Notes
@wesley/core	graphql, @noble/hashes	pure only
@wesley/cli	none (prefer zero)	all I/O via adapters
@wesley/host-node	yargs-parser, pino, pg (later), fast-glob	node only
@wesley/generator-supabase	none	prefer templates
@wesley/generator-js	none	templates only
@wesley-scaffold-*	none	data-only
@wesley-stack-*	none	data-only
@wesley/tasks	@noble/hashes	pure
@wesley/slaps	none	pure
@wesley/runner-pg (later)	pg, pg-format	node only


⸻

Public exports (fences)

Each package’s package.json should expose only what you intend:

// example
{
  "name": "@wesley/cli",
  "type": "module",
  "exports": {
    ".": "./src/index.mjs",
    "./main": "./src/main.mjs",
    "./commands": "./src/commands/index.mjs"
  }
}

Rule: no package/src/* imports across packages. CI should fail them.

⸻

Interaction Rules (enforced in CI)
	•	No Node in core: dep-cruise rule blocks node:*, fs, path, url, process in wesley-core.
	•	No CLI/host imports from core: block @wesley-(cli|host-node) from wesley-core.
	•	Journaled idempotency: SLAPS must consult journal before running a node.
	•	Resource gates: DB handlers declare resources:["db:postgres"] to serialize DDL.
	•	Re-run = no-op: generation pipeline must be stable; generate → no diff on second run.

⸻

Quick examples (so it’s unambiguous)
	•	“I need to add a tenant_admins_only RLS policy.”
→ Implement in @wesley/generator-supabase/emitters/rls.mjs.
	•	“I want a wesley watch command.”
→ CLI command in @wesley/cli/commands/watch.mjs; file watching adapter in host-node; orchestrate via SLAPS.
	•	“I need to chunk a backfill with retries.”
→ Step handler in @wesley/runner-pg; executed by SLAPS with resources:["db:postgres"].
	•	“I want to add a Marketplace scaffold.”
→ Create @wesley-scaffold-marketplace (schema + README).
→ Extend @wesley-stack-supabase-nextjs/recipe.json with "marketplace" recipe.
	•	“I want to calculate IR hashes for the certificate.”
→ Pure hashing in @wesley/tasks/hash.mjs (or in core if it’s IR-level).

⸻

Final sanity check: if you’re unsure, use this:
	1.	Does it parse or define schema/IR? → core.
	2.	Does it choose what to run, in what order? → tasks.
	3.	Does it run steps and track progress? → slaps.
	4.	Does it talk to the OS or DB? → host-node (adapters) or runner-pg (handlers).
	5.	Does it spit out code or SQL? → generators.
	6.	Is it a pre-baked schema? → scaffold.
	7.	Is it a mapping of scaffold→generators? → stack.

If it doesn’t cleanly fit one of those, it probably doesn’t belong yet. Cut it or prototype in /labs.

⸻

This gives you hard seams, clear APIs, and a ruthless placement policy. Stick to it and your repo stays sharp—even while Wesley grows fangs.
