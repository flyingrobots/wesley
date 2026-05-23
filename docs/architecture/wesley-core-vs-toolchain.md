# Wesley Core Versus Toolchain

<!-- docs-truth: status=current owner=@flyingrobots -->

This note freezes the layer split that keeps Wesley understandable.

The short version is:

> Wesley core is a compiler. The wider Wesley toolchain also packages,
> verifies, and helps distribute compiler outputs.

Those are related jobs. They are not the same job.

## 1. Wesley Core: Compiler

At its center, Wesley should be read like a compiler:

- input: authored GraphQL SDL and related authored contract files
- compile: validate, lower to IR, run generators, emit targets
- output: files written where the caller asked for them

In that sense, the clean mental model is close to a C compiler:

```text
wesley compile --schema <path> --target <targets> --out-dir <dir>
```

The compiler core should not need to know what Continuum, Echo, `warp-ttd`, or
`jedit` "mean" as projects. It only needs to know:

- the authored input
- the enabled directives/extensions
- the chosen generators/targets
- the requested output roots

## 2. Generators And Extensions

Wesley is not only a parser. It is an extensible compiler.

That means it can learn new semantics through:

- directives in authored GraphQL
- generator plugins
- target emitters
- IR transforms that are still generic compiler machinery

This is the right place for project-specific meaning to enter Wesley.

So if Continuum owns special authored families or directives, the correct
compiler story is:

- Continuum owns the schema
- Wesley compiles that schema
- any Continuum-specific behavior enters through a loaded Continuum module
  rather than by making the compiler core secretly project-aware

## 3. Toolchain Surfaces Around The Compiler

The current Wesley repo also contains surfaces that are **not** the compiler
core, even though they are implemented in the same project:

- realization manifests
- witness and conformance commands
- release/bundle assembly
- sync/projection helpers
- HOLMES / Watson / Moriarty / BLADE judgment tooling

These are best read as **toolchain layers around the compiler**.

They operate on:

- authored source identity
- emitted artifacts
- publication boundaries
- proof/certification results

They are real and useful. They should not be confused with the core compile
act.

## 4. Continuum-Specific Module Policy

`@wesley/continuum` is not the Wesley compiler.

It is a Wesley-side package that currently holds Continuum-specific defaults
such as:

- named scope profiles
- publication-boundary defaults
- consumer projection defaults
- judgment profile settings

That means `@wesley/continuum` is better understood as:

- a product profile
- a module bootstrap package
- a workflow helper layer

not as part of the compiler's essence.

If a Continuum preset disappears tomorrow, Wesley should still be a compiler.

Long term, the real Continuum module should live in the Continuum repo and be
loaded by Wesley rather than baked into the Wesley repo.

## 5. How Continuum Fits

Continuum should own:

- authored shared schemas
- stack manifests
- workspace/bootstrap doctrine
- the user-facing `warp` CLI

Wesley should:

- compile Continuum-authored schemas
- emit generated artifacts
- optionally package and verify those artifacts

`warp` then sits **above** Wesley:

- `warp` stages the workspace
- `warp` resolves toolchain inputs
- `warp` invokes Wesley internally

So the intended stack is:

```text
Continuum owns the authored family
  -> Wesley compiles it
  -> optional Wesley toolchain surfaces package / verify it
  -> warp orchestrates it for app authors
```

Observer-facing surfaces belong on the Continuum side of this boundary, not in
generic Wesley.

## 6. Practical Rule

When a new idea appears, ask which layer it belongs to:

| Question                                        | Layer                                            |
| ----------------------------------------------- | ------------------------------------------------ |
| "What does this GraphQL mean?"                  | Wesley compiler core / generators                |
| "What files get emitted?"                       | Wesley compiler core                             |
| "How do we prove these outputs are coherent?"   | Wesley toolchain                                 |
| "How do we package/version/sync those outputs?" | Wesley toolchain or a higher orchestration layer |
| "Which schema is canonical for Continuum?"      | Continuum                                        |
| "How does a user bootstrap a WARPspace?"        | Continuum `warp`                                 |

If those questions get collapsed into one blob, repo truth starts to drift.

## 7. Current Honest Posture

Today Wesley is **both**:

- a compiler
- a repo that also carries packaging, witness, and project-profile tooling

That is acceptable as long as the docs stay explicit about the split.

The wrong mental model is:

- Wesley intrinsically knows what Continuum is
- release/sync are part of compilation itself
- project-level workflow presets are compiler law

The right mental model is:

- Wesley core compiles authored contracts into targets
- the surrounding Wesley toolchain can package, verify, and project those
  outputs
- modules own domain-specific policy and extension surfaces
- Continuum owns its own schemas, observer-facing contracts, and higher-level
  orchestration concerns

That is the separation we should preserve.
