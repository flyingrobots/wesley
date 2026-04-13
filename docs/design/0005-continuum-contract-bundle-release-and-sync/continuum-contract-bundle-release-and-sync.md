---
title: "Continuum Contract Bundle Release and Sync"
---

## Sponsors

- Human: I can change a Continuum shared schema, publish one versioned contract
  bundle, and know exactly how Echo, `git-warp`, and `warp-ttd` are supposed
  to consume it without guessing whether they should import Wesley as a
  library.
- Agent: I can inspect the repo and answer what the primary release unit is,
  which versions matter, and how cross-repo sync works without collapsing
  Wesley-side policy packages into consumer-facing artifacts.

## Hill

Wesley becomes the boring compiler and certifier for one versioned Continuum
contract bundle, while Continuum remains the semantic owner and neighboring
repos consume released generated artifacts rather than Wesley compiler
internals.

## Scope Hard Condition

This packet only counts as useful if a maintainer can answer all of the
following without folklore:

- whether active consumer repos should import `@wesley/continuum`
- what the primary cross-repo release unit is
- how semver relates to exact schema identity
- how Wesley package versions differ from contract-family versions
- how one release propagates into Echo, `git-warp`, and `warp-ttd`

## Current Problem

Wesley already has most of the ingredients for stable cross-repo publication:

- one authored-home doctrine
- deterministic compile paths
- exact schema identity through `schemaHash` / `sourceHash`
- realization shells for generated legs
- witness and drift-watch surfaces for bounded proof

But the repo still lacks one explicit answer to the operator question:

> what is the thing I release, version, hand to other repos, and compare
> against their mirrors?

That gap creates three recurring confusions:

1. `@wesley/continuum` can look like the thing consumer repos should depend on,
   even though it is a Wesley-side product profile.
2. Wesley package versions exist, but they do not currently name one released
   shared contract family across repos.
3. Drift-watch can compare mirrors, but the repo still lacks a first-class
   release object that those mirrors are expected to match.

## Decision Summary

1. The primary cross-repo release unit is a **versioned contract bundle**.
2. Consumer repos should normally consume **generated bundle projections**,
   not Wesley compiler internals.
3. `@wesley/continuum` remains a **Wesley-side product profile package**, not
   the universal dependency every neighboring repo should import.
4. Versioning is **dual**:
   - human semver for compatibility and release management
   - exact `schemaHash` / `sourceHash` for machine identity
5. Sync is an explicit, witnessed operation, not an implied side effect of
   changing files in several repos.

## Ownership Split

| Surface | Owner | Role |
| --- | --- | --- |
| Authored shared family schema | Continuum | Semantic authority; release intent and compatibility decision |
| Generic compiler, realization, witness, drift engine | Wesley core/CLI/host packages | Compile, package, certify, compare |
| Product profile for Continuum | `@wesley/continuum` | Scope defaults, publication-boundary policy, consumer conventions, Holmes/Watson/Moriarty framing |
| Runtime behavior and local mirrors | Echo, `git-warp`, `warp-ttd` | Consume generated artifacts and keep runtime-specific behavior honest |

This keeps the current doctrinal split intact:

- Continuum owns semantics and authored homes.
- Wesley owns compilation, publication boundary, realization, and bounded proof.
- Neighboring repos own runtime behavior and local mirror use.

## Recommended Consumer Model

The recommended consumer surface is **not** `@wesley/core` or
`@wesley/continuum`.

The recommended consumer surface is:

- one versioned contract bundle
- or one generated language/package projection emitted from that bundle

That means:

- `warp-ttd` should read stable generated protocol surfaces, not compiler
  internals
- Echo should read generated IR or Rust/TypeScript projections, not compiler
  internals
- `git-warp` should eventually do the same for any shared Continuum families it
  consumes

`@wesley/continuum` exists so Wesley commands can load Continuum-specific
policy without hardcoding it into generic compiler logic. It is a producer-side
profile, not the primary consumer artifact.

## Primary Release Unit: Contract Bundle

The released thing should be a bundle directory or archive with one root
manifest. The bundle root should be the source of release truth for consumers.

Illustrative shape:

```text
continuum-receipt-family/
  bundle.json
  source/
    authority.json
    admitted.graphql            # optional admitted snapshot; never re-labeled as authority
  realization/
    manifest.json
  witness/
    conformance.json
  targets/
    warp-ttd/...
    echo/...
  compatibility/
    consumers.json
```

### `bundle.json`

The root manifest should be something like `wesley.contract.bundle.v1` and
carry at least:

- `profile`: e.g. `continuum`
- `family`: e.g. `receipt-family`
- `release`: human semver for the contract family
- `sourceAuthority`: repo/path/ref or equivalent authority descriptor
- `sourceHash`: exact admitted schema identity
- `compiler`: Wesley package version and, when available, git commit
- `targets`: emitted legs and their artifact roots
- `realization`: realization shell path and digest
- `witness`: witness scope, status, output path, and witness schema/version
- `compatibility`: declared consumer mirrors or published package projections

The key point is that `bundle.json` names **one release object**. The target
files remain derived projections.

## Versioning Model

The versioning model should separate human compatibility from exact identity.

### 1. Contract Family Semver

Each shared family gets a release semver controlled by the family owner.
For Continuum-owned shared families, that means Continuum decides whether the
next admitted change is major, minor, or patch.

Recommended rule:

- `major`: breaking change for stable consumers
- `minor`: additive or otherwise backward-compatible contract change
- `patch`: repackaging, witness metadata, or projection changes where the
  admitted contract identity does not change

### 2. Exact Identity Hash

Every released bundle must also carry the exact admitted schema identity:

- `sourceHash` for the admitted authored SDL
- target-local hashes such as `schemaHash` where the emitted family already
  exposes them

This exact hash is the machine authority for:

- drift detection
- mirror verification
- bundle equality
- deterministic reproduction

### 3. Format Versions

Target families still keep their own format versions:

- `echo-ir/v2`
- `ttd-ir/v1`
- `manifest.version`
- `@wes_version(...)` on shared schema types

Those are not the same thing as contract-family semver. They version emitted
formats and schema-local envelopes, not the whole cross-repo release object.

### 4. Wesley Package Versions

Package versions such as `@wesley/cli@0.1.0` are compiler/toolchain versions.
They should be recorded in the bundle, but they do not replace contract-family
versioning.

## Foreign-Authored Home Rule

Wesley must stay honest when compiling from a foreign-authored home.

If Continuum authors the shared schema, the bundle may carry an admitted
snapshot for reproducibility, but the bundle must still name:

- the foreign repo
- the authority path
- the admitted ref or commit when known

The snapshot is an admitted compile input, not a retroactive claim that Wesley
or a consumer repo became the schema authority.

## Sync Model

Release and sync should be explicit operations.

### Release

A future release command should:

1. compile the declared targets from the authored home
2. verify the realization shell
3. run the declared witness scope
4. assemble `bundle.json` and the emitted bundle root
5. optionally produce publishable language/package projections

Illustrative surface:

```bash
pnpm wesley contract release \
  --profile continuum \
  --family receipt-family \
  --schema ../continuum/schemas/continuum-receipt-family.graphql \
  --release 0.1.0 \
  --target warp-ttd,echo
```

### Sync

A future sync command should:

1. read a released bundle
2. resolve the profile's declared consumer roots or explicit repo arguments
3. update only the generated consumer surfaces
4. rerun drift-watch or equivalent mirror verification
5. fail if the consumer repo still diverges from the released bundle

Illustrative surface:

```bash
pnpm wesley contract sync \
  --profile continuum \
  --bundle ./out/continuum-receipt-family-0.1.0 \
  --consumer warp-ttd \
  --repo ../warp-ttd
```

The important design choice is that sync runs **from the bundle**, not from
compiler internals or handwritten copy commands.

## Delivery Forms

One bundle may produce several consumer-facing forms:

- a checked-in generated root under a consumer repo
- a TypeScript package projection
- a Rust/IR projection for runtime generators
- a local inspect bundle for humans and witness tooling

Those are all projections of one released contract bundle, not parallel sources
of truth.

## Interaction With `@wesley/continuum`

`@wesley/continuum` should own the Continuum-specific parts of this release
model:

- family names and scope defaults
- declared consumer kinds and conventional roots
- publication-boundary policy
- semver bump guidance for Continuum families
- Holmes/Watson/Moriarty framing attached to bundle reports

It should not become the cross-repo universal dependency for consumers.

## Why This Is Better Than “Just Ship A Library”

Making every repo depend on Wesley packages directly would blur ownership:

- it makes compiler internals look like stable consumer API
- it weakens the published/generated boundary
- it couples runtime repos to Wesley implementation churn
- it makes exact release identity harder to reason about

A versioned contract bundle keeps the seam honest:

- Continuum authors
- Wesley compiles and certifies
- consumers ingest released generated artifacts

## Follow-On Work

This packet implies one implementation surface, not five vague ones:

- add generic `wesley contract release` and `wesley contract sync` commands
  with profile support
- teach `@wesley/continuum` to declare consumer kinds and bundle policy
- emit a root `bundle.json` that binds semver, exact hashes, realization, and
  witness together
- let drift-watch compare consumer mirrors against released bundles directly

## Playback Questions

### Human

- [ ] Can I explain why `@wesley/continuum` is not the thing `warp-ttd` should
      import to stay in sync?
- [ ] Can I name one release object that ties schema authority, semver, exact
      identity, realization, and witness together?
- [ ] Can I tell the difference between Wesley package version and shared
      contract-family version?

### Agent

- [ ] Can I describe the consumer path as “consume a bundle or bundle
      projection” instead of “import compiler internals”?
- [ ] Can I explain how a foreign-authored schema remains authoritative even if
      a released bundle carries an admitted snapshot?
- [ ] Can I state exactly how semver and `schemaHash` work together instead of
      picking one and hand-waving the other away?

## Non-goals

- Turn Wesley into the runtime engine for Echo, `git-warp`, or `warp-ttd`.
- Make `@wesley/continuum` the one package every consumer repo must import.
- Replace current witness scopes with a universal end-to-end platform proof.
- Finish every cross-repo cutover in this packet.
