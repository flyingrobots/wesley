# Wesley Glossary
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is the fast onboarding glossary for Wesley.

Use it when you need to answer three questions quickly:

1. What are the main nouns in Wesley?
2. Which layer does each noun belong to?
3. Where does Wesley stop and project-specific meaning begin?

## Wesley In One Sentence

Wesley is a schema-first contract compiler with a surrounding toolchain.

The core compiler turns authored GraphQL into targets.
The toolchain can package, witness, and project those outputs.
Projects like Continuum sit above Wesley and decide what to compile, where outputs go, and which policies apply.

Wesley is bigger than the Continuum lane. It also includes database-change tooling, generic code generators, host adapters, evidence tooling, scaffolds, and supporting runtime packages.

## Layers

### 0. Wesley Base Platform

The generic base platform.

This layer is project-agnostic. It provides the engines and entry points that modules and projects build on top of.

It includes:

- the Wesley compiler core
- Holmes and Watson verification and witness tooling
- Moriarty judgment and prediction tooling
- BLADE certification and release-readiness orchestration
- generic CLI, hosts, and shared plumbing

### 0a. Package Families Inside The Base Platform

These are the main package families inside the Wesley repo today.

#### CLI And Entry Surfaces

Packages and commands that expose Wesley to humans and scripts.

Examples:

- `@wesley/cli`
- top-level `pnpm wesley ...` command surfaces

#### Generators

Packages that emit target-specific artifacts from Wesley IR.

Examples:

- `@wesley/generator-js`
- `@wesley/generator-echo`
- `@wesley/generator-ttd`
- `@wesley/generator-supabase`
- `@wesley/generator-vue`

#### Hosts

Packages that provide environment-specific runtime services for running Wesley.

Examples:

- `@wesley/host-node`
- `@wesley/host-browser`
- `@wesley/host-deno`
- `@wesley/host-bun`

#### Runtime Support

Generic runtime-side helpers that are not themselves the compiler core.

Examples:

- `@wesley/runtime-node`

#### Evidence, Judgment, And Certification

Packages and commands that evaluate, summarize, certify, or gate bounded claims around compiler outputs.

Examples:

- `@wesley/holmes`
- witness and realization verification commands
- plan and rehearse flows
- BLADE command surfaces

#### Supporting Utilities

Packages that support scheduling, planning, fixtures, or internal shared operations.

Examples:

- `@wesley/tasks`
- `@wesley/slaps`
- `@wesley/test-fixtures`

#### Scaffolds And Stacks

Early project templates or packaged starting points built on Wesley outputs.

Examples:

- `@wesley/scaffold-multitenant`
- `@wesley/stack-supabase-nextjs`

### 1. Wesley Extension Modules

The extension layer above the base platform.

Modules extend Wesley through explicit hooks rather than by contaminating the base platform.

An extension module may add:

- custom GraphQL directives
- generator plugins
- witness scopes or verification profiles
- judgment or policy rules
- certification profiles
- bundle or projection behavior
- BLADE environment setup and additional test suites

Examples:

- Database module
- Continuum module
- project-specific custom modules

Generic modules should not be forced to implement observer surfaces.
Observer-facing contracts are Continuum-only.

### 2. Project Workspace

The user's actual working project.

This layer contains:

- authored schemas
- project config
- project-specific tests and policies
- generated outputs
- local custom modules
- deployment machinery owned by the project, not by Wesley

An ordinary project should usually only need to provide:

- authored schemas
- selected module(s)
- module configuration
- optional project tests
- optional BLADE environment setup and extra test hooks

If a project is being asked to hand-author witness scopes, publication
boundaries, consumer projections, and judgment profiles directly, the module
boundary is probably wrong.

## Base Platform Nouns

### Wesley

The schema-first compiler engine at the center of the base platform.

Wesley parses authored GraphQL, lowers it into IR, and drives generator plugins to emit target artifacts.

### Holmes

A verification and evidence tool.

Holmes evaluates bounded properties around proposed or emitted change and produces machine-readable evidence about what passed, failed, or needs attention.

### Watson

A witness and verification companion surface.

Watson is part of the bounded proof story: it helps turn authored source, emitted artifacts, and realization shells into explicit witness material rather than vague confidence.

### Moriarty

A policy, judgment, and prediction tool.

Moriarty evaluates rules, risk, gates, or counterfactuals that go beyond raw compilation and beyond simple artifact coherence.

### BLADE

The certification and release-readiness orchestrator.

BLADE composes compiler outputs, witness/evidence results, tests, and judgments into a tested, certified, deployable bundle or readiness verdict.

BLADE stops short of deployment. Deployment belongs to the project or operator layer.

Projects may extend BLADE with environment setup, additional tests, and custom gate behavior without turning Wesley itself into a deployment system.

## Module Nouns

### Module

A domain- or ecosystem-specific extension family built on Wesley base platform.

A module may extend compilation, witness, judgment, certification, or bundle
behavior without contaminating the base platform.

### Submodule

A narrower capability family inside a broader module.

Examples:

- Postgres inside a Database module
- Echo inside a Continuum module

### Family

A bounded authored GraphQL contract slice that is versioned, compiled,
witnessed, and released as one unit.

A family is the authored unit, not the proof claim and not the consumer view.

### Scope

A named claim boundary for what a witness or certification act is proving about
a family.

### Projection

A consumer-facing emitted view derived from a family.

## Boundary Nouns

### Publication-Boundary Policy

The rule set that says where a family is allowed to live and where its
generated projections are allowed to land.

Its job is to prevent shadow authored homes and stray generated artifacts from
becoming peer authorities.

The base platform may provide enforcement machinery, but modules should supply
the actual policy.

### Continuum-Only Observer Nouns

Observer-facing nouns belong only to the Continuum module.

Those include:

- the GraphQL-authored families `ObserverSpec`, `ObserverPlan`, and
  `ReadingEnvelope`
- observer state codec artifacts compiled from those families
- hosted observer runtime contracts in Continuum runtimes that later produce
  values conforming to those families

Generic Wesley and non-Continuum modules should use simpler read-side nouns
such as reports, projections, inspections, summaries, and certification
results.

## Compiler Nouns

### Schema

The authored GraphQL source file.

In Wesley, the schema is the sovereign source of truth. Generated outputs are derived from it and should not become peer authorities.

The schema is an input, not an extension point.

### Directive

Structured GraphQL syntax that adds meaning to the schema.

Directives are one of Wesley's main extension points. They let a schema express extra compilation intent without abandoning GraphQL as the authored surface.

### IR

Intermediate Representation.

This is the compiler's internal, normalized form of the authored schema. Generators compile from IR, not directly from raw SDL text.

### Generator Plugin

A pluggable emitter that takes Wesley IR and produces one or more target artifacts.

Examples include TS/Zod, Echo, TTD, Vue, and Postgres-facing generators.

### Target

A requested output family or emission leg.

A target answers the question: "What kind of thing should Wesley emit from this schema?"

Examples:

- TypeScript types
- Zod validators
- Echo codecs and IR
- TTD protocol structures
- SQL or RLS output

### Artifact

A concrete emitted file or structured output produced by a generator.

An artifact is generated truth derived from authored truth. It is useful and inspectable, but it is not the governing source.

### Contract Family

A bounded authored GraphQL family that is versioned, compiled, witnessed, and
released as one unit.

A contract family is authored truth. Wesley compiles artifacts for it. Tools
and runtimes later may produce actual values that conform to it.

### Runtime Value

An actual execution-time value later produced by a runtime or tool using Wesley
outputs.

Examples:

- a `TickResult` value emitted by Echo
- a `ReadingEnvelope` value emitted by a Continuum runtime
- a Holmes, Watson, Moriarty, or BLADE report value

Wesley does not emit runtime values. Wesley emits compiled artifacts.

## Toolchain Nouns

### CLI

The command-line entry surface for Wesley.

The CLI is not the compiler core itself. It is the main human-facing ingress that invokes the compiler and related toolchain operations.

### Realization

The concrete emitted output set for a compile act.

If the schema is authored truth, realization is the physically emitted leg of that truth.

### Realization Shell

The packaging boundary around emitted artifacts.

It exists so Wesley can track source identity, output identity, and bounded claims about what was emitted, without pretending the emitted files are now the authority.

### Witness

A bounded proof artifact produced by Wesley about a specific claimed property.

A witness does not mean "everything is true." It means Wesley has certified a named property under a named scope.

### Scope

A named boundary for what a witness or toolchain action is claiming.

A scope answers the question: "What exactly are we certifying or packaging here?"

### Bundle

A versioned, portable package that groups together the outputs and metadata needed for a consumer to use a released contract family.

A bundle may include emitted artifacts, realization metadata, witness material, and consumer projection information.

### Profile

A named toolchain preset.

A profile provides policy defaults for packaging, witness, sync, or other higher-level operations. Profiles are not compiler core; they are workflow sugar.

### Consumer

A downstream repo, runtime, or host project that receives or uses Wesley outputs.

Examples in this ecosystem include app repos, runtimes like `echo`, debugger/protocol consumers like `warp-ttd`, or database/application hosts consuming generated contracts.

### Projection

A consumer-shaped emitted view of a released contract family.

Projection is about where and how a released family lands in a consumer environment.

### Host Adapter

A package that lets Wesley run in a specific execution environment.

Host adapters handle environment-shaped concerns such as filesystem access, process execution, or browser-safe operation without changing compiler truth.

### Runtime Adapter

A supporting package that helps generated or compiled outputs operate inside a runtime environment.

This sits outside the pure compiler core but can still be generic and reusable.

### Policy Engine

A toolchain surface that evaluates proposed changes or emitted artifacts against declared rules.

In this repo, Holmes and Moriarty are the main examples.

### Scaffold

A starter package or template that helps initialize a project using Wesley-generated outputs and conventions.

Scaffolds are consumers of Wesley, not the compiler itself.

### Stack

A higher-level packaged composition of schema, generated outputs, app wiring, and host assumptions.

Stacks are closer to product delivery than to compiler infrastructure.

## Extension And Boundary Nouns

### Module

A domain- or ecosystem-specific extension family built on the Wesley base platform.

Modules extend the compiler, witness, judgment, or certification surfaces through explicit extension points.

### Submodule

A narrower extension family inside a module.

Examples:

- a Postgres submodule inside the Database module
- an Echo or TTD submodule inside the Continuum module

### Database Module

The family of extensions that teaches Wesley about database-facing generation, planning, verification, or certification concerns.

This module may contain submodules such as Postgres or Supabase-specific behavior.

### Continuum Module

The family of extensions that teaches Wesley about Continuum-specific schema families, projections, witness scopes, judgments, and certification behavior.

This module may contain submodules such as Echo- or TTD-facing integrations.

### Host

The environment that runs Wesley or hosts its generated outputs.

Examples:

- the local Node CLI
- a browser host
- a repo-local workspace bootstrap flow

### WARPspace

A host-project bootstrap and workspace concept used in the Continuum stack.

It is not Wesley core. It is a project-level orchestration surface that invokes Wesley.

### `warp`

The Continuum-owned orchestration tool.

`warp` should sit above Wesley. It decides how a Continuum workspace is initialized, which shared families are materialized, and how Wesley is invoked as part of that process.

### Continuum Wesley Module

The Continuum-owned Wesley module and profile surface now lives in the
Continuum repo under `continuum/wesley/`.

It is not compiler core. It extends Wesley from outside the Wesley repo.

## Practical Rule

When you are confused, ask this in order:

1. Is this authored source?
2. Is this compiler internals?
3. Is this emitted output?
4. Is this packaging/witness/toolchain metadata?
5. Is this project-specific policy living above Wesley?

That question usually tells you which layer a noun belongs to.

## Short Version

If you only remember one picture, remember this:

```text
Project workspace
  -> extension modules add domain meaning
  -> Wesley base platform compiles, verifies, judges, and certifies
  -> project-owned deployment and runtime layers consume the resulting bundles and artifacts
```

Wesley is strongest when those layers stay separate.
