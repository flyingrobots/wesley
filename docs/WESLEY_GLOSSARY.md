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

### 1. Wesley Core

The pure compiler layer.

This layer is responsible for:

- parsing authored GraphQL
- lowering it into IR
- running generator plugins
- emitting target artifacts
- writing outputs where the caller asked

This layer should stay project-agnostic.

### 2. Wesley Toolchain

The generic surfaces around the compiler.

This layer can include:

- generic generators
- realization manifests and shells
- witness and conformance commands
- bundle, release, and sync helpers
- generic technology extensions such as TS, Zod, Echo, TTD, or Postgres emitters

These are useful, but they are not the compiler's essence.

### 2a. Package Families Inside The Toolchain

These are the main non-core package families in this repo today.

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

#### Evidence And Policy

Packages and commands that evaluate, summarize, or certify bounded properties around compiler outputs.

Examples:

- `@wesley/holmes`
- witness and realization verification commands
- plan and rehearse flows

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

### 3. Project Semantics And Extensions

The project-owned layer above Wesley.

This layer defines:

- authored schema families
- project-specific profiles and presets
- project-specific bundle and publication policy
- project-specific judgment roles
- orchestration tools that invoke Wesley as part of a larger workflow

For Continuum, this is where `warp` belongs.

## Core Nouns

### Schema

The authored GraphQL source file.

In Wesley, the schema is the sovereign source of truth. Generated outputs are derived from it and should not become peer authorities.

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

In this repo, HOLMES is the main example.

### Scaffold

A starter package or template that helps initialize a project using Wesley-generated outputs and conventions.

Scaffolds are consumers of Wesley, not the compiler itself.

### Stack

A higher-level packaged composition of schema, generated outputs, app wiring, and host assumptions.

Stacks are closer to product delivery than to compiler infrastructure.

## Boundary Nouns

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

### `@wesley/continuum`

A Continuum-specific preset/profile package currently living inside the Wesley repo.

It is not compiler core. Long-term, much of this package likely belongs in Continuum once the extension-loading and ownership boundaries are cleaner.

### Database-Change Lane

The Wesley workflow that compiles authored schema and operations into database-facing plans, migrations, or evidence.

This is an important part of Wesley's current identity. Wesley is not only the Continuum contract lane.

### Continuum Contract Lane

The Wesley workflow that compiles shared causal protocol families and related cross-repo contract surfaces.

This is one major usage lane of Wesley, but not the only one.

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
Project-owned schema and policy
  -> Wesley core compiles GraphQL into IR and targets
  -> Wesley toolchain provides generators, hosts, evidence, packaging, and projections
  -> host projects, runtimes, database lanes, and app stacks consume the resulting artifacts
```

Wesley is strongest when those layers stay separate.
