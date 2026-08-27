# Guide — Wesley

This is the developer-level operator guide for Wesley. Use it for orientation,
the productive-fast path, and the domain-free compiler/toolchain split.

For deep-track doctrine, IR model internals, and custom generator development, use [ADVANCED_GUIDE.md](./ADVANCED_GUIDE.md).

If this is your first hour with Wesley, start with
[Plain Wesley](./topics/plain-wesley.md): GraphQL in, deterministic JSON IR out,
optional generic emitters, and external targets own runtime meaning.

Use [WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md) after that when you need the full
Wesley noun map and advanced toolchain vocabulary.

If you know the task you are trying to perform and need the shortest current
route, start with [Topics](./topics/README.md).

## Choose Your Lane

### 1. Core Compiler Lane

Compile authored GraphQL into generic or explicitly selected generated
artifacts.

- **Inspect native CLI**: `cargo run --bin wesley -- --help`
- **Read native CLI reference**: [docs/reference/cli.md](./reference/cli.md)
- **Doctor native CLI**: `cargo run --bin wesley -- doctor`
- **Install release alpha after publication**: `cargo install wesley-cli --version 0.2.0`
- **Install locally**: `cargo install --locked --path crates/wesley-cli`
- **Strict preflight**: `cargo xtask preflight`
- **Explicit alias**: `cargo xtask strict-preflight`
- **Release check**: `cargo xtask release-check`
- **Project manifest**: `cargo run --bin wesley -- config validate --json`
- **Changed schemas**: `cargo run --bin wesley -- config changed-schemas --changed <path> --json`

The Rust-native CLI is now the normal front door for Wesley core work. The
native binary stays small while core behavior moves into the Rust library.
`wesley-core` exposes generic operation analysis primitives for resolving
selection paths and extracting directive arguments; Echo-owned tooling owns
Echo-specific footprint honesty checks.
Use `wesley normalize-sdl --schema <path>` when you need the consolidated,
sorted SDL view that the Rust compiler sees before emission or diffing. Add
`--hash` when you need stable evidence bytes for a normalized SDL snapshot.
Use `wesley doctor` when you need a narrow Rust-native health check for the
native CLI, Rust lowerer, normalized SDL hashing, and Rust emitter crates. It
does not inspect legacy Node config, plugins, or package state.

Use `cargo install wesley-cli --version 0.2.0` for the release alpha once the
signed tag has published to crates.io. Use `cargo run --bin wesley -- ...` when
working directly from this checkout before publication, or
`cargo install --locked --path crates/wesley-cli` when you need a local
installed binary. Use `cargo xtask preflight` before opening a PR. This is the
strict quality gate: it runs `cargo fmt --check`,
`cargo clippy --workspace --all-targets -- -D warnings`, docs checks, workspace
tests, and a native CLI smoke test. Use `cargo xtask release-check` before cutting native release
artifacts; it runs the same strict gate, then builds the optimized binary,
smokes it, and packages the Rust library crate without publishing anything.

The historical package CLI is retired. Use the native commands:

- **Lower**: `wesley schema lower --schema <path> --json`
- **Hash**: `wesley schema hash --schema <path>`
- **Diff**: `wesley schema diff --old <old> --new <new> --format summary`
- **Manifest Validate**: `wesley config validate [--config <manifest>] [--json]`
- **Manifest Inspect**: `wesley config inspect [--config <manifest>] [--json]`
- **Changed Schemas**: `wesley config changed-schemas [--config <manifest>] [--changed <path> ...] [--changed-file <path>] [--json]`

- **Rust**: `wesley emit rust --schema <path> --out <path>`
- **TypeScript**: `wesley emit typescript --schema <path> --out <path>`
- **LE Binary Rust**: `wesley emit le-binary-rust --schema <path> --out <path> [--codec-import <path>]`
- **LE Binary TypeScript**: `wesley emit le-binary-typescript --schema <path> --out <path> [--codec-import <path>]`
- **Emit metadata**: add `--metadata-out <path>` to record schema hash,
  generator identity, generator version, and `rust-native` execution mode.

For legacy migration users still calling `pnpm wesley`, rewrite the caller.
The direct replacements are `wesley schema lower`, `wesley schema hash`,
`wesley schema diff`, `wesley doctor`, and `wesley emit typescript` or
`wesley emit rust`.
Zod and certificate commands are no longer generic compiler-front-door work.
Holmes-family commands still live under `@wesley/holmes`. Use the
[Assurance Capability Matrix](./reference/assurance-capability-matrix.md) for
the shipped/transitional/foundation/concept status of each assurance surface.

Zod output is no longer treated as core Wesley retirement work. Reintroduce it
through an external target module or package when a consumer needs JavaScript
validation output.

### 2. External Module Lane

Bring the domain side of `GraphQL SDL -> deterministic Wesley IR -> your domain`
through an owning module, package, or sibling repo. The historical Node dynamic
module loader and `wesley.config.mjs` command-dispatch path are retired; the
native Rust CLI does not currently load arbitrary JavaScript modules as product
commands.

External targets still own target semantics, generators, witness scopes,
release profiles, and runtime conventions. Today that ownership is expressed
through explicit Rust emitters, descriptor-only fixture modules, external repos
such as `wesley-postgres`, or future target protocols. Wesley core does not own
those meanings. Use [Project Manifest](./reference/project-manifest.md) for
current config-driven schema and target metadata, and
[Module Authoring Guide](./guides/module-authoring.md) for the current extension
boundary.
For the active ownership rule, see
[design/0014-domain-empty-core-boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md).

Historical Continuum, WARPspace, PostgreSQL, and Supabase package residue has
been removed from the compiler front door. New domain behavior should land in
the owning repo, package, or explicitly designed target boundary, not in Wesley
core.

### 3. Governance & Inspection

Audit proposed changes, emit HOLMES reports, and inspect the static dashboard
artifact assembled by CI.
These are assurance/tooling surfaces outside compiler authority.

Wesley emits deterministic evidence inputs and ships experimental assurance
tooling around them; an assurance capability is shipped only when the
[Assurance Capability Matrix](./reference/assurance-capability-matrix.md) lists
an executable command or workflow.

- **HOLMES report**: `pnpm --filter @wesley/holmes exec node src/cli.mjs report --help`
- **Dashboard artifact**: open `docs/holmes-dashboard/index.html` with the
  HOLMES workflow JSON artifacts. See
  [architecture/holmes-integration.md](./architecture/holmes-integration.md#report-validation--dashboard).

## Compiler Versus Toolchain

Wesley is easiest to understand if you keep two layers separate.

### Wesley core

The core compiler behaves like a compiler:

- authored GraphQL in
- targets selected explicitly
- outputs written where the caller asks

That is the center of the system.

### Wesley toolchain

This repo also ships surrounding toolchain surfaces:

- realization manifests
- witness/conformance commands
- release/bundle assembly
- sync/projection helpers
- HOLMES / Watson / Moriarty / BLADE

Those surfaces operate on compiler inputs and outputs. They are useful, but
they are not the same thing as the core compile act. They are advanced
assurance/toolchain vocabulary, not prerequisites for the first compiler path.
Watson, Moriarty, and BLADE remain concept/design vocabulary unless the
Assurance Capability Matrix marks the surface shipped.

For the exact boundary, see
[architecture/wesley-core-vs-toolchain.md](./architecture/wesley-core-vs-toolchain.md).

For practical extension rules, see [guides/extending.md](./guides/extending.md).

For the noun-by-noun version of that split, see
[WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md).

## Advanced: System Orchestration

Wesley is a tiered engine designed to enforce contract integrity across platforms:

1. **Compiler API (Surfaces)**: The CLI and internal SDK are thin interfaces that communicate with the core. They ensure that all transformations are explicit and logged.
2. **Compiler Core (The Engine)**: Manages the GraphQL parser, the platform-neutral IR, and the transmutation pipeline. It ensures that "Trustworthy Change" is a technical guarantee.
3. **Realization Shells (Packaging)**: Each emitted leg carries a manifest and signatures that let Wesley verify source identity and artifact integrity without treating generated files as authorities.
4. **Witness Surfaces (Proof)**: Witness commands certify bounded properties against authored source, emitted artifacts, and realization shells. They do not stand in for runtime observation unless a scope explicitly proves that too.

## Orientation Checklist

- [ ] **I am setting up Rust core work**: Run `cargo xtask preflight`.
- [ ] **I am changing docs only**: Run `cargo xtask docs-check`.
- [ ] **I am changing retained JS packages or pnpm workspace files**: Use the pnpm version in `packageManager`, run `pnpm install --frozen-lockfile`, `cargo xtask preflight`, and `cargo xtask legacy-preflight`.
- [ ] **I am modifying a schema**: Always start in the `.graphql` file.
- [ ] **I am adding a generic projection**: Start in `crates/wesley-emit-rust` or `crates/wesley-emit-typescript`.
- [ ] **I am adding a domain target**: Put it in an owning external repo or design an explicit target protocol before wiring it into Wesley.
- [ ] **I am extending Wesley**: Use `docs/guides/extending.md` to pick the Rust core, native CLI, emitter, external module, or `xtask` boundary.
- [ ] **I am configuring schema sets**: Use `docs/reference/project-manifest.md` and validate with `wesley config validate`.
- [ ] **I am contributing to Wesley**: Read `METHOD.md` and `BEARING.md`.
- [ ] **I am touching Continuum behavior**: Work in the Continuum-owned module/repo, not here.
- [ ] **I am touching PostgreSQL or Supabase behavior**: Work in `wesley-postgres`, not here.

## Rule of Thumb

If you need the native command reference, use [CLI Reference](./reference/cli.md)
or `cargo run --bin wesley -- --help`.

If you need to know "what's true right now," use [BEARING.md](./BEARING.md).

If you need the exact boundary between authored source, realization shells, and
bounded witness claims, use [design/0004-realization-admission-and-witness/realization-admission-and-witness.md](./design/0004-realization-admission-and-witness/realization-admission-and-witness.md).

If you need the clean split between Wesley base platform, extension modules,
and project workspaces, use
[WESLEY_GLOSSARY.md](./WESLEY_GLOSSARY.md) and
[design/wesley-pipeline.md](./design/wesley-pipeline.md).

If you are just starting, use the [README.md](../README.md) and the orientation tracks above.

---

**The goal is inevitably. Every state transition is a provable consequence of the sovereign schema.**
