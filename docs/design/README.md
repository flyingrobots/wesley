# Design Packets

Design packets live here as specifications, boundary notes, and durable
evidence. They are not live progress trackers.

Work slices live in GitHub Issues. Goalposts live in GitHub Milestones. The
roadmap board lives in the
[Wesley Roadmap Project](https://github.com/users/flyingrobots/projects/18).

Use [`TEMPLATE.md`](./TEMPLATE.md) as the starting point for every new design
packet or PRD slice.

Packet directories may also carry supporting implementation notes, playback
closeouts, and retrospectives for slices completed under that packet.

Do not add packet-local progress bars, live slice ledgers, or unchecked
roadmap checklists. Use
[Wesley Documentation Standard](../governance/DOCUMENTATION_STANDARD.md) for
the repo documentation contract.

Current packets:

- [`0001`](./0001-wesley-invariants/wesley-invariants.md): Wesley invariants
- [`0002`](./0002-wesley-legends/wesley-legends.md): Wesley legends
- [`0003`](./0003-continuum-contract-compiler/continuum-contract-compiler.md): Historical product-lane packet; extraction context only
- [`0004`](./0004-realization-admission-and-witness/realization-admission-and-witness.md): Generic realization admission and witness
- [`0005`](./0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md): Historical product bundle packet; extraction context only
- [`0006`](./0006-warpspace-workspace-resolution/warpspace-workspace-resolution.md): Historical product workspace packet; extraction context only
- [`0007`](./0007-observer-spec-and-plan/observer-spec-and-plan.md): Historical product observer packet; extraction context only
- [`0008`](./0008-holmes-counterfactual-provider-capability/holmes-counterfactual-provider-capability.md): Holmes counterfactual provider capability dispatch
- [`0009`](./0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md): Rust-native compiler kernel and WASM capability ABI design
- [`0010`](./0010-wesley-graft-mcp-boundary/wesley-graft-mcp-boundary.md): Wesley+Graft MCP boundary for operation footprint and repository aperture checks
- [`0011`](./0011-causal-suffix-bundle-family-and-runtime-sync/causal-suffix-bundle-family-and-runtime-sync.md): Causal suffix bundle family and runtime sync
- [`0012`](./0012-product-leftover-cleanup/product-leftover-cleanup.md): Product leftover cleanup for the v0.0.5 clean-house release
- [`0013`](./0013-rust-ir-parity-sentinel/rust-ir-parity-sentinel.md): Rust IR parity sentinel for the v0.0.6 compiler-truth release, including the
  [parser parity spike](./0013-rust-ir-parity-sentinel/SOURCE_parser-parity-spike.md),
  [type-family parity projection](./0013-rust-ir-parity-sentinel/SOURCE_type-family-parity-projection.md)
  and
  [Rust core performance baseline](./0013-rust-ir-parity-sentinel/EVIDENCE_rust-core-performance-baseline.md)
- [`0014`](./0014-domain-empty-core-boundary/domain-empty-core-boundary.md): Domain-empty Wesley core boundary for the v0.0.6 compiler-truth release
- [`0015`](./0015-resilience-policy-boundary/resilience-policy-boundary.md): Resilience policy boundary for `ninelives` in Rust and `@git-stunts/alfred` in JavaScript tooling
- [`0016`](./0016-rust-core-binding-observatory/rust-core-binding-observatory.md): Rust core binding observatory for Node/Rust/WASM cutover evidence
- [`0017`](./0017-rust-native-front-door-and-node-retirement/rust-native-front-door-and-node-retirement.md): Rust native front door and legacy Node retirement campaign, including
  [assurance and capability extraction](./0017-rust-native-front-door-and-node-retirement/ASSURANCE_AND_CAPABILITY_EXTRACTION.md)
  and
  [host compatibility boundary](./0017-rust-native-front-door-and-node-retirement/HOST_COMPATIBILITY_BOUNDARY.md),
  plus the
  [legacy compatibility matrix](./0017-rust-native-front-door-and-node-retirement/LEGACY_COMPATIBILITY_MATRIX.md)
  and
  [parity sentinel archive](./0017-rust-native-front-door-and-node-retirement/PARITY_SENTINEL_ARCHIVE.md),
  plus the
  [leaf package deletion audit](./0017-rust-native-front-door-and-node-retirement/LEAF_PACKAGE_DELETION_AUDIT.md)
  and
  [generator JS deletion audit](./0017-rust-native-front-door-and-node-retirement/GENERATOR_JS_DELETION_AUDIT.md),
  ending with the
  [final closeout](./0017-rust-native-front-door-and-node-retirement/FINAL_CLOSEOUT.md)
- [`0018`](./0018-holmes-assurance-hexagon/holmes-assurance-hexagon.md):
  Holmes assurance hexagon redesign with CLI, API, MCP, and reporting adapters,
  now backed by the initial `crates/wesley-holmes` Rust foundation
- [`0019`](./0019-weslaw-semantic-law-ir/weslaw-semantic-law-ir.md): `weslaw`
  semantic Law IR for contract bundles, strict binding, canonical law hashes,
  semantic diffs, and deferred SDL+ syntax, including the v1
  [Law IR](./0019-weslaw-semantic-law-ir/LAW_IR_V1.md),
  [coordinate and registry](./0019-weslaw-semantic-law-ir/COORDINATES_AND_REGISTRIES.md),
  and
  [canonicalization and diagnostic](./0019-weslaw-semantic-law-ir/CANONICALIZATION_AND_DIAGNOSTICS.md)
  substrate notes
- [`0020`](./0020-holmes-weslaw-assurance-prd-test-plan/holmes-weslaw-assurance-prd-test-plan.md):
  completed Holmes `weslaw` assurance PRD and test-plan campaign. Rust Holmes
  implementation work is tracked by GitHub Issues and goalpost milestones, not
  packet-local status docs
- [`0021`](./0021-continuum-yolo-runtime-neutral-edict-sha-lock-assurance/continuum-yolo-runtime-neutral-edict-sha-lock-assurance.md):
  extracted Continuum lawful-autonomous lane and runtime-neutral Edict packet;
  the canonical specs now live in
  [flyingrobots/edict](https://github.com/flyingrobots/edict)
- [Module Contract](./wesley-module-contract.md): Generic core boundary versus external module-owned domain surfaces
- [Module Capability Contract](./wesley-module-capability-contract.md): The capability surfaces external modules should implement
- [Contract / Artifact / Runtime Boundary](./wesley-contract-family-artifact-runtime-value.md): GraphQL-authored families, Wesley-emitted artifacts, and later runtime values
- [Pipeline Note](./wesley-pipeline.md): Wesley, Holmes, Watson, Moriarty, and BLADE as a bundle pipeline
- [Extraction Map](./wesley-extraction-map.md): What still does not belong in generic Wesley and where it should move
