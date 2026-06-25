# BEARING

<!-- docs-truth: status=experimental owner=@flyingrobots -->

Current direction and active tensions. Historical ship data lives in
`CHANGELOG.md`. Live backlog, progress, and release-roadmap state lives in
GitHub Issues, Milestones, Projects, and labels.

This page is not a tracker. If a count, checkbox, queue, or release gate can
change without a code/docs commit, it belongs in GitHub.

## Roadmap Authority

Wesley's live work hierarchy is:

| Concept            | Canonical Surface                                                           |
| ------------------ | --------------------------------------------------------------------------- |
| Goalpost           | GitHub Milestone named `Goalpost: ...`                                      |
| Slice              | GitHub Issue assigned to exactly one goalpost milestone                     |
| Release            | GitHub Milestone named `Release: vX.Y.Z`                                    |
| Release gate       | GitHub Issue assigned to the release milestone and linked to goalposts      |
| Roadmap board      | [Wesley Roadmap Project](https://github.com/users/flyingrobots/projects/18) |
| Lane/legend/status | GitHub Issue labels                                                         |

GitHub permits only one milestone per issue. Implementation issues therefore
stay in goalpost milestones. Versioned release milestones hold release-gate
issues that link to the goalposts selected for that release.

The current formal goalpost and release list is the GitHub milestone list:
<https://github.com/flyingrobots/wesley/milestones>.

## Active Gravity

### 1. Rust-Native Compiler Spine

The legacy Node compiler surface is retired. The current Wesley product spine is
the Rust workspace: `crates/wesley-core`, `crates/wesley-cli`, retained emitters,
Rust L1 fixtures, and `cargo xtask` verification.

Wesley should behave like a normal Rust-native compiler project with JavaScript
only where it has an explicit non-compiler owner: Holmes assurance, docs
tooling, and small repository automation. The old product website/playground
surface and the browser/Bun/Deno host experiments are retired from the Wesley
release surface.

### 2. Domain-Empty Core

- Wesley's identity is the core `GraphQL -> whatever` compiler and assurance
  toolchain.
- The `whatever` must come from an owning external target, module, or sibling
  repo, not built-in product or database semantics.
- [0014-domain-empty-core-boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)
  is the active ownership doctrine.
- Echo, jedit, Continuum, WARPspace, `warp-ttd`, and PostgreSQL behavior belong
  in owning repos or modules, not generic Wesley core.

### 3. Rust L1 Fixture Truth

- Treat the Rust workspace as the primary compiler surface.
- Expand the canonical fixture corpus before broad rewrites.
- Keep nondeterministic metadata out of parity-sensitive IR bytes.
- Preserve directive spelling, alias normalization, extension folding, and
  invalid-SDL diagnostics as explicit tests.
- Keep jedit-shaped consumer fixtures as compiler coverage, not jedit product
  ownership.

### 4. Module Capability Boundary

- Use the module capability registry as the seam between explicit target
  descriptors and Wesley base verbs.
- Do not resurrect the retired Node `wesley compile` dispatch path.
- Future target execution must go through a Rust-native registry, WASM boundary,
  or external-process protocol with explicit capability reporting.
- Keep Wesley core CI independent of external product and database repos by
  exercising hermetic fixture modules.

### 5. Holmes And `weslaw` Assurance

`weslaw` is Wesley's semantic law layer for contract bundles. GraphQL SDL remains
sovereign over structural shape. `weslaw` becomes sovereign over semantic law.
The combined, bound, canonical contract bundle is the unit Wesley hashes, diffs,
emits, explains, validates, and hands to assurance tools.

Holmes should mature as an assurance layer over Wesley-published evidence. It
may validate, judge, report, publish, and audit that evidence. It must not
reinterpret GraphQL shape, mutate law, rebind law, invent semantic diffs, or
become the source of truth for contract bundles.

Durable design evidence:

- [0018 Holmes Assurance Hexagon](./design/0018-holmes-assurance-hexagon/holmes-assurance-hexagon.md)
- [0019 `weslaw` Semantic Law IR](./design/0019-weslaw-semantic-law-ir/weslaw-semantic-law-ir.md)
- [0020 Holmes `weslaw` Assurance PRD And Test Plan](./design/0020-holmes-weslaw-assurance-prd-test-plan/holmes-weslaw-assurance-prd-test-plan.md)

### 6. Sibling Repo Boundaries

- `wesley-postgres` owns PostgreSQL/Supabase generation, execution adapters, and
  database safety primitives.
- Edict owns Edict language/Core IR/canonicalization/target-profile ABI.
- Echo owns Echo target semantics.
- Continuum owns participant protocol and admission.
- Wesley owns GraphQL and `weslaw` source-profile adapters plus compiler
  evidence integration.

Wesley should coordinate through generic module seams, contract artifacts, hashes,
and evidence, not by absorbing sibling runtime semantics.

### 7. Release Discipline

`v0.1.0` established the Rust-native release floor and the shared LE binary codec
plan. Future releases must be cut from signed tags on synced `main`; do not merge
post-release evidence backfills to `main` after a release boundary.

Versioned release work is tracked by `Release: ...` milestones and release-gate
issues. The release policy and checklist remain the operational source:

- [Release Policy](./governance/RELEASE_POLICY.md)
- [Release Checklist](./governance/RELEASE_CHECKLIST.md)

## Tensions

- **Roadmap Drift**: Markdown files must not become parallel backlog or progress
  trackers. If it is live state, move it to GitHub.
- **Rust Native Discipline**: New compiler behavior belongs in Rust crates unless
  there is an explicit non-compiler owner.
- **Fixture Churn**: IR, hash, directive, or generated-artifact changes can
  affect Echo and jedit fixtures. Those changes need explicit compatibility
  notes rather than accidental hash churn.
- **Alias Semantics**: Legacy directive aliases are compatibility input, not a
  license to preserve arbitrary spelling in semantic Rust L1 output.
- **Invalid Diagnostics**: Parser diagnostics have stable codes and spans, but
  semantic lowering spans must not be implied by tests or release notes unless
  they are actually present.
- **External Module Gap**: The domain-empty boundary is named; the module seam
  still needs hermetic target-dispatch fixtures, runtime boundary evidence, and
  artifact evidence before external modules can consume it cleanly.
- **Law Versus Runtime Meaning**: `weslaw` lets Wesley preserve and reason about
  semantic law. Target meaning and runtime behavior still belong to owning
  modules and sibling repos.

## Durable Closeouts

Historical closeouts remain useful evidence, but they are not active work queues:

- [Legacy Node Retirement Final Closeout](./design/0017-rust-native-front-door-and-node-retirement/FINAL_CLOSEOUT.md)
- [Rust Core Binding Observatory Archive](./design/0016-rust-core-binding-observatory/rust-core-binding-observatory.md)
- [Parity Sentinel Archive](./design/0017-rust-native-front-door-and-node-retirement/PARITY_SENTINEL_ARCHIVE.md)
- [Edict Extraction Locator](./design/0021-continuum-yolo-runtime-neutral-edict-sha-lock-assurance/continuum-yolo-runtime-neutral-edict-sha-lock-assurance.md)

## Next Target

Use the [Wesley Roadmap Project](https://github.com/users/flyingrobots/projects/18)
and GitHub milestones for exact ordering. Product gravity remains:

1. keep the post-`v0.1.0` Rust-native release floor boring and reproducible,
2. harden evidence truth around Holmes and `weslaw`,
3. preserve the domain-empty module boundary while external targets consume
   Wesley artifacts, and
4. cut only from tagged `main` once release-gate issues are satisfied.
