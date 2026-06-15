# ARCHITECTURE

<!-- docs-truth: status=experimental owner=@flyingrobots -->

Wesley is a schema-first compiler kernel and assurance toolchain.

The current architecture is intentionally narrower than older product-era docs:

```text
authored GraphQL -> Wesley core facts -> module-owned targets / evidence / hosts
```

Wesley owns compiler truth. External modules and sibling repos own target
semantics, runtime policy, database behavior, Echo behavior, and deployment.
The active ownership doctrine is
[Domain-Empty Core Boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md).

If you are trying to figure out where to start, read
[ENTRYPOINTS.md](./ENTRYPOINTS.md) first. This document is the deeper structural
map; the entrypoint map is the short answer to "which Wesley do I run or edit?"

For the noun-by-noun reference, use [WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md).
For current direction and active tensions, use [BEARING.md](./BEARING.md).
For work doctrine, use [METHOD.md](./METHOD.md).

## Where This Leaves Us

The repo is now split into three practical layers:

1. **Rust kernel / brain**: `crates/wesley-core` is the emerging authoritative
   compiler library. It lowers GraphQL SDL into L1 IR, diffs L1 schema
   structure, lists schema root operations, and exposes generic operation facts.
2. **Native CLI / body**: `crates/wesley-cli` is the Rust product command. It
   exposes schema lowering, schema hashing, schema operation listing, schema
   diffing, Rust/TypeScript emission, operation selection analysis, and
   directive argument extraction from Rust crates.
3. **Rust Holmes assurance foundation**: `crates/wesley-holmes` is the new
   law-assurance foundation for Holmes evidence, versioning, ports, and future
   reports. It consumes Wesley-published artifacts and does not expose product
   CLI commands yet.
4. **Non-compiler JavaScript surfaces**: `packages/` now contains Holmes
   assurance tooling and browser/Bun/Deno host smoke experiments only. These
   packages are not release authority, compiler authority, or product
   entrypoints.

The most recent boundary cleanup removed root-level footprint checking from
Wesley. `wesley-core` now exposes generic operation selection and directive
argument extraction. Echo-specific footprint honesty belongs in Echo-owned
tooling, not in generic Wesley.

## System Context

```mermaid
flowchart LR
    Author[Human or agent author] --> SDL[Authored GraphQL SDL]
    Author --> OP[GraphQL operation documents]

    subgraph WesleyRepo["Wesley repository"]
        subgraph Rust["Rust workspace"]
            Core[wesley-core]
            RustEmitter[wesley-emit-rust]
            TsEmitter[wesley-emit-typescript]
            RustHolmes[wesley-holmes]
            NativeCli[wesley-cli]
            Xtask[xtask]
        end

        subgraph JS["Non-compiler JavaScript"]
            Holmes["@wesley/holmes"]
            Browser["@wesley/host-browser"]
            Bun["@wesley/host-bun"]
            Deno["@wesley/host-deno"]
        end

        Docs[docs/]
        Schemas[schemas/]
        Fixtures[test/fixtures/]
        Scripts[scripts/]
    end

    subgraph External["External owners"]
        Echo[Echo-owned Wesley integration]
        Postgres[wesley-postgres]
        Continuum[Continuum-owned modules]
        Apps[Project workspaces]
    end

    SDL --> Core
    OP --> Core
    NativeCli --> Core
    NativeCli --> RustEmitter
    NativeCli --> TsEmitter
    RustEmitter --> Core
    TsEmitter --> Core
    RustHolmes --> Fixtures
    Xtask --> NativeCli
    Xtask --> Core

    Core --> Fixtures
    Holmes -. transitional assurance UI .-> RustHolmes
    Scripts --> Docs
    Scripts -. package hygiene .-> JS

    Core -. generic facts .-> Echo
    Core -. L1 IR .-> Postgres
    Core -. module facts .-> Continuum
    RustEmitter -. generated artifacts .-> Apps
    TsEmitter -. generated artifacts .-> Apps
```

The dashed arrows are intentional boundaries. Wesley can produce facts and
artifacts that external systems consume, but it should not absorb their runtime
semantics.

## Repo Tour

| Path                                                                     | Role                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `crates/wesley-core/`                                                    | Rust compiler kernel. Parses/lower SDL to domain-empty L1 IR, diffs L1 schema structure, lists schema root operations, and analyzes operation documents.                 |
| `crates/wesley-cli/`                                                     | Native Rust `wesley` binary for schema deltas, schema hashes, Rust/TypeScript artifacts, and operation facts.                                                            |
| `crates/wesley-emit-rust/`                                               | Rust projection crate. Builds a Rust item/type AST from L1 IR and `SchemaOperation` data, then prints deterministic model and operation declarations.                    |
| `crates/wesley-emit-typescript/`                                         | Rust TypeScript projection crate. Builds a TypeScript declaration AST from L1 IR and `SchemaOperation` data, then prints deterministic model and operation declarations. |
| `crates/wesley-holmes/`                                                  | Rust Holmes law-assurance foundation. Defines pure domain models, deterministic ports/fakes, evidence bundle validation, artifact path resolution, and version diagnostics without exposing public CLI commands yet. |
| `xtask/`                                                                 | Rust repository automation: docs checks, tests, native preflight, release check, and package hygiene bridge.                                                             |
| `packages/wesley-holmes/`                                                | Existing JavaScript Holmes surface outside compiler authority while the Rust assurance foundation grows behind it.                                                        |
| `packages/wesley-host-browser/`, `wesley-host-bun/`, `wesley-host-deno/` | External host smoke experiments pending deletion or externalization.                                                                                                     |
| `schemas/`                                                               | JSON schemas and generic directive/schema assets used by tooling and tests.                                                                                              |
| `test/fixtures/`                                                         | GraphQL fixtures, Rust L1 goldens, package examples, and reference schemas.                                                                                              |
| `scripts/`                                                               | Preflight, docs truth, docs link, fixture generation, smoke, and CI helper scripts.                                                                                      |
| `docs/`                                                                  | Operator docs, architecture, design packets, audits, specs, method docs, and archived backlog migration evidence.                                                        |
| `.github/workflows/`                                                     | CI workflows for Rust, packages, docs, hosts, security, and progress badges.                                                                                             |

Some directories still contain extraction residue. In particular,
`packages/wesley-generator-echo/` exists on disk but is not an active tracked
source package in this architecture. Echo-owned work should happen in Echo.
The former `packages/wesley-generator-vue/` and `packages/wesley-generator-js/`
packages have been deleted; target-specific generators should return only
through external target owners or Rust-native emitters.
The former `packages/wesley-scaffold-multitenant/`,
`packages/wesley-test-fixtures/`, and `packages/wesley-tasks/` packages are
also deleted. Product scaffolds belong to product repos, fixture helpers belong
as plain `test/fixtures` or Rust test assets, and generic task execution remains
descriptor-only until Rust planning proves a runtime need.

## Rust Kernel

`crates/wesley-core` is the cleanest current source of compiler truth.

It has three internal areas:

| Area     | Files            | Responsibility                                                    |
| -------- | ---------------- | ----------------------------------------------------------------- |
| Domain   | `src/domain/*`   | IR structs, operation-analysis structs, error types, hashes.      |
| Ports    | `src/ports/*`    | Host-neutral traits such as `LoweringPort`.                       |
| Adapters | `src/adapters/*` | Concrete parser/lowering implementation, currently Apollo Parser. |

Public Rust APIs currently include:

- `lower_schema_sdl(sdl) -> WesleyIR`
- `list_schema_operations_sdl(schema_sdl) -> Vec<SchemaOperation>`
- `diff_schema_sdl(old_sdl, new_sdl) -> SchemaDelta`
- `diff_schema_ir(old_ir, new_ir) -> SchemaDelta`
- `resolve_operation_selections(operation_sdl) -> Vec<String>`
- `resolve_operation_selections_with_schema(schema_sdl, operation_sdl) -> Vec<String>`
- `extract_operation_directive_args(operation_sdl, directive_name) -> Vec<OperationDirectiveArgs>`
- `compute_registry_hash(ir) -> String`
- `compute_content_hash(content) -> String`
- `to_canonical_json(value) -> String`

### Rust Flow

```mermaid
flowchart TD
    SDL[GraphQL SDL] --> Apollo[Apollo parser]
    Apollo --> CST[CST document]
    CST --> Consolidation[Semantic consolidation]
    Consolidation --> Types[Type definitions]
    Types --> IR[WesleyIR L1]
    IR --> Canonical[Canonical JSON]
    Canonical --> Hash[Registry hash]
    IR --> Delta[Schema delta]
    SDL --> RootOps[SchemaOperation catalog]
    RootOps --> EmitOps[Operation bindings]

    OP[GraphQL operation] --> OpParse[Operation parser]
    OpParse --> Selections[Response-path selections]
    OpParse --> Directives[Directive argument JSON]
    SDL --> SchemaIndex[Schema index]
    SchemaIndex --> Coordinates[Schema-coordinate selections]
    OpParse --> Coordinates
```

L1 IR is domain-empty. It knows GraphQL types, fields, directives, interfaces,
unions, enum values, input objects, nullability, lists, and source-level
directive data. It does not know tables, Echo graph nodes, migrations, routes,
deployments, or runtime policy.

## Rust Emitters

`crates/wesley-emit-rust` and `crates/wesley-emit-typescript` are the first Rust
projection crates. They do not parse or rewrite existing source files. They take
`WesleyIR` for models and, when available, `SchemaOperation` data for root
operation bindings. Each crate builds structured language-specific ASTs and
prints deterministic artifacts.

This generation path does not need tree-sitter. Tree-sitter, SWC, oxc, or a
similar parser becomes relevant when Wesley needs to inspect or edit existing
source files. Pure generation starts from an AST owned by the emitter. The Rust
emitter tests validate generated Rust syntax with `syn`.

Operation binding emission is still domain-empty. It connects operation kind,
root field name, argument object types, result type, and preserved directive
metadata. It does not interpret Echo footprint directives or bind operations to
Postgres, Continuum, or any other target runtime.

### Rust Class Diagram

```mermaid
classDiagram
    class WesleyIR {
        +String version
        +Option~Metadata~ metadata
        +Vec~TypeDefinition~ types
    }

    class TypeDefinition {
        +String name
        +TypeKind kind
        +Option~String~ description
        +IndexMap directives
        +Vec~String~ implements
        +Vec~Field~ fields
        +Vec~String~ enum_values
        +Vec~String~ union_members
    }

    class Field {
        +String name
        +Option~String~ description
        +TypeReference type
        +IndexMap directives
    }

    class TypeReference {
        +String base
        +bool nullable
        +bool is_list
        +Option~bool~ list_item_nullable
    }

    class OperationDirectiveArgs {
        +String directive_name
        +IndexMap arguments
    }

    class SchemaOperation {
        +OperationType operation_type
        +String root_type_name
        +String field_name
        +Vec~OperationArgument~ arguments
        +TypeReference result_type
        +IndexMap directives
    }

    class OperationArgument {
        +String name
        +TypeReference type
        +Option~Value~ default_value
        +IndexMap directives
    }

    class SchemaDelta {
        +Vec~TypeDelta~ added_types
        +Vec~TypeDelta~ removed_types
        +Vec~TypeModification~ modified_types
    }

    class TypeModification {
        +String name
        +bool breaking
        +Vec~SchemaElementChange~ field_changes
        +Vec~SchemaElementChange~ enum_value_changes
        +Vec~SchemaElementChange~ union_member_changes
        +Vec~SchemaElementChange~ directive_changes
    }

    class TsProgram {
        +Vec~TsDeclaration~ declarations
    }

    class RustFile {
        +Vec~RustItem~ items
    }

    class RustItem {
        <<enum>>
        Struct
        Enum
        TypeAlias
        Operation
    }

    class RustType {
        <<enum>>
        String
        I32
        F64
        Bool
        Vec
        Option
    }

    class TsDeclaration {
        <<enum>>
        Interface
        TypeAlias
        Operation
    }

    class TsTypeExpr {
        <<enum>>
        String
        Number
        Boolean
        Null
        Reference
        Typeof
        Object
        Array
        Union
    }

    class LoweringPort {
        <<trait>>
        +lower_sdl(sdl)
    }

    class ApolloLoweringAdapter {
        +new(usize)
        +parse_and_lower(sdl)
    }

    class WesleyError {
        <<enum>>
        ParseError
        LoweringError
        ResilienceError
    }

    WesleyIR "1" --> "*" TypeDefinition
    TypeDefinition "1" --> "*" Field
    Field "1" --> "1" TypeReference
    SchemaOperation "1" --> "*" OperationArgument
    SchemaOperation "1" --> "1" TypeReference
    OperationArgument "1" --> "1" TypeReference
    SchemaDelta "1" --> "*" TypeModification
    RustFile "1" --> "*" RustItem
    RustItem --> RustType
    TsProgram "1" --> "*" TsDeclaration
    TsDeclaration --> TsTypeExpr
    LoweringPort <|.. ApolloLoweringAdapter
    ApolloLoweringAdapter --> WesleyIR
    ApolloLoweringAdapter --> WesleyError
```

### L1 IR Entity Relationship

```mermaid
erDiagram
    WESLEY_IR ||--o{ TYPE_DEFINITION : contains
    TYPE_DEFINITION ||--o{ FIELD : declares
    FIELD ||--|| TYPE_REFERENCE : has
    TYPE_DEFINITION ||--o{ SCHEMA_OPERATION : roots
    SCHEMA_OPERATION ||--o{ OPERATION_ARGUMENT : accepts
    SCHEMA_OPERATION ||--|| TYPE_REFERENCE : returns
    OPERATION_ARGUMENT ||--|| TYPE_REFERENCE : has
    TYPE_DEFINITION ||--o{ DIRECTIVE_VALUE : annotates
    FIELD ||--o{ DIRECTIVE_VALUE : annotates
    SCHEMA_OPERATION ||--o{ DIRECTIVE_VALUE : annotates
    OPERATION_ARGUMENT ||--o{ DIRECTIVE_VALUE : annotates
    TYPE_DEFINITION ||--o{ IMPLEMENTS_EDGE : implements
    TYPE_DEFINITION ||--o{ UNION_MEMBER : includes
    TYPE_DEFINITION ||--o{ ENUM_VALUE : declares

    WESLEY_IR {
        string version
        object metadata
    }
    TYPE_DEFINITION {
        string name
        string kind
        string description
    }
    FIELD {
        string name
        string description
    }
    TYPE_REFERENCE {
        string base
        bool nullable
        bool is_list
        bool list_item_nullable
    }
    SCHEMA_OPERATION {
        string operation_type
        string root_type_name
        string field_name
    }
    OPERATION_ARGUMENT {
        string name
        json default_value
    }
    DIRECTIVE_VALUE {
        string name
        json arguments
    }
    IMPLEMENTS_EDGE {
        string interface_name
    }
    UNION_MEMBER {
        string type_name
    }
    ENUM_VALUE {
        string value
    }
```

## Native CLI And Xtask

The native CLI exposes Rust-backed compiler facts:

```mermaid
flowchart LR
    User --> CargoWesley[cargo wesley checkout alias]
    User --> InstalledWesley[installed wesley binary]
    CargoWesley --> WesleyBin[crates/wesley-cli]
    InstalledWesley --> WesleyBin
    WesleyBin --> SchemaLower[schema lower]
    WesleyBin --> SchemaHash[schema hash]
    WesleyBin --> SchemaOperations[schema operations]
    WesleyBin --> SchemaDiff[schema diff]
    WesleyBin --> EmitRust[emit rust]
    WesleyBin --> EmitTypescript[emit typescript]
    WesleyBin --> OpSelections[operation selections]
    WesleyBin --> DirectiveArgs[operation directive-args]
    WesleyBin --> CoreFacts[wesley-core]

    Maintainer --> CargoXtask[cargo xtask]
    CargoXtask --> DocsCheck[docs-check]
    CargoXtask --> Tests[cargo test --workspace]
    CargoXtask --> NativeHelp[cargo run --bin wesley -- --help]
    CargoXtask --> Release[cargo build --release + package wesley-core]
    CargoXtask --> Legacy[cargo xtask legacy-preflight]
    Legacy --> Pnpm[pnpm run legacy-preflight]
```

`schema diff` has two input modes. The explicit mode compares two schema files.
The Git-aware mode compares the working-tree schema against the same path at a
Git revision:

```bash
wesley schema diff --old old.graphql --new new.graphql
wesley schema diff --schema schema.graphql --against HEAD
wesley schema diff --schema schema.graphql --base origin/main
```

`cargo xtask preflight` is the ordinary product health check. It runs
Rust-native docs hygiene checks, Rust workspace tests, and verifies the native
CLI help surface. `cargo xtask legacy-preflight` intentionally crosses into
JavaScript package tooling only for retained package or pnpm-workspace changes.

## Non-Compiler JavaScript Tooling

The legacy Node compiler packages are gone. JavaScript remains for Holmes-era
assurance tooling, website/docs tooling, repository scripts, and browser/Bun/Deno
host smoke experiments. These are not the preferred home for new compiler-kernel
truth.

The retained JS split is:

- `@wesley/holmes`: self-contained assurance, verification, counterfactual, and
  reporting tooling.
- `@wesley/host-browser`, `@wesley/host-bun`, `@wesley/host-deno`: external host
  smoke experiments with local parser/hash adapters.
- website/docs/repository scripts: supporting automation, not compiler
  authority.

### Module Capability Model

External modules are the JS-side extension seam. A module has an API version,
a name, optional initialization, optional CLI command registration, and optional
structured capabilities.

Capability areas are currently:

- `wesley`: directives, targets, generators, bundle profiles, realization verifiers.
- `holmes`: scopes, checks, evidence collectors, counterfactual providers.
- `watson`: verifiers, audit profiles.
- `moriarty`: policy profiles, judgment profiles, predictors.
- `blade`: scenarios, fixtures, environment setup, tests, gates, certification profiles.
- `cli`: commands.

```mermaid
erDiagram
    MODULE ||--o{ MODULE_SUMMARY : records
    MODULE ||--o{ CAPABILITY_ENTRY : contributes
    CAPABILITY_REGISTRY ||--o{ MODULE_SUMMARY : lists
    CAPABILITY_REGISTRY ||--o{ CAPABILITY_AREA : contains
    CAPABILITY_AREA ||--o{ CAPABILITY_COLLECTION : contains
    CAPABILITY_COLLECTION ||--o{ CAPABILITY_ENTRY : stores

    MODULE {
        string apiVersion
        string name
    }
    MODULE_SUMMARY {
        string name
        string apiVersion
    }
    CAPABILITY_REGISTRY {
        object modules
        object capabilities
    }
    CAPABILITY_AREA {
        string name
    }
    CAPABILITY_COLLECTION {
        string name
    }
    CAPABILITY_ENTRY {
        string moduleName
        object value
    }
```

### Module-Aware Compile Flow

```mermaid
sequenceDiagram
    actor User
    participant CLI as Rust wesley CLI
    participant Registry as Capability descriptors
    participant Target as External target module
    participant Core as Rust compiler facts
    participant Out as Generated artifacts

    User->>CLI: wesley module command with schema and target
    CLI->>Registry: resolve target descriptor and capability needs
    CLI->>Target: run selected target boundary
    Target->>Core: consume schema facts as needed
    Target->>Out: emit target-owned artifacts
    CLI->>User: summary / dry-run / errors
```

This is still a useful surface. The architectural rule is that target meaning
comes from the module, not from generic Wesley.

## Assurance And Evidence

Wesley keeps separate layers for authored source, compiler facts, generated
artifacts, and bounded evidence:

```mermaid
flowchart TD
    Source[Authored source] --> IR[Lowered IR]
    IR --> Artifact[Generated artifact family]
    Artifact --> Shell[Realization shell]
    Source --> Evidence[Witness / evidence]
    IR --> Evidence
    Artifact --> Evidence
    Shell --> Evidence
    Evidence --> Judgment[Judgment / certification]
```

The key invariant is not "the generated files are true." The invariant is:

```text
generated files are derived from named authored source through a recorded tool path
```

Witness and evidence outputs are bounded claims. They should say exactly what
was checked and should not pretend to be runtime observation unless that is the
explicit witness scope.

## What Wesley Does Today

Wesley currently does these things in this repo:

- Lowers GraphQL SDL into a Rust L1 IR with consolidated type definitions.
- Preserves generic directives as JSON values in type and field IR.
- Computes canonical JSON and SHA-256 registry/content hashes.
- Lists schema root operations with argument types, result types, and
  directives.
- Resolves operation selection paths in response-path mode.
- Resolves operation selection paths in schema-coordinate mode.
- Extracts operation directive arguments by directive name.
- Provides a native Rust workspace preflight and release check.
- Maintains non-compiler JavaScript tooling only where it has an explicit owner.
- Maintains docs, schemas, fixtures, CI scripts, and design packets around the
  broader compiler-and-assurance system.

## What Wesley Does Not Own

Wesley does not own these semantics:

- Echo rewrite scheduling or footprint honesty enforcement.
- PostgreSQL migrations, SQL lowering, RLS policy, or database deployment.
- Continuum product/runtime behavior.
- Project-specific deployment.
- Agent repository aperture policy.
- Host-specific runtime trust decisions beyond its own module-loading guards.

Those systems may consume Wesley facts. They should not become Wesley core.

## Test And Evidence Surfaces

```mermaid
flowchart LR
    RustTests[cargo test --workspace] --> CoreTests[core lowering + operation analysis]
    RustTests --> CliTests[native CLI help/unknown command]
    Preflight[cargo xtask preflight] --> RustTests
    Preflight --> NativeHelp[native help smoke]
    Legacy[cargo xtask legacy-preflight] --> Pnpm[pnpm run legacy-preflight]
    Pnpm --> Links[docs links]
    Pnpm --> DocsTruth[docs truth manifest]
    Pnpm --> Literals[forbidden local literals]
    Pnpm --> CliDocs[front-door CLI docs guard]
    Pnpm --> DepCruise[dependency-cruiser]
```

Use native checks for Rust-core work. Use `cargo xtask docs-check` for docs
only. Use legacy preflight when changing retained JS packages, pnpm workspace
files, or JavaScript tooling behavior.

## Ownership Rules

1. If it changes GraphQL parsing, L1 IR, operation analysis, canonical JSON, or
   compiler hashes, it belongs in `crates/wesley-core`.
2. If it is a native user command, add it only when it is backed by pure
   `wesley-core` behavior and documented as current.
3. If it is repository automation, put it in `xtask` or a script called by
   `xtask`.
4. If it is target semantics, make it a module or put it in the owning external
   repo.
5. If it is Echo, PostgreSQL, Continuum, or app runtime meaning, keep it outside
   generic Wesley.
6. If docs describe old product surfaces, mark them as historical/extraction
   context or remove the current-surface wording.

## North Star

Wesley is becoming a Rust library that can be embedded by other systems while
still preserving package-era module workflows during the transition.

The durable shape is:

```text
Rust core: deterministic compiler facts
Native CLI: small local executable surface
WASM / bindings: future portable capability boundary
JavaScript packages: assurance and host experiments outside compiler authority
External modules: target and domain meaning
Project workspaces: authored schemas, policy, runtime, deployment
```

That shape keeps the compiler honest. Wesley says what the schema and operation
mean. Other systems decide what those facts imply for their runtime.

---

**The goal is inevitably. Wesley owns compiler truth; target worlds own their own meaning.**
