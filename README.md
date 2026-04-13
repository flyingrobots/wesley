<div align="center">
<img src="https://github.com/user-attachments/assets/0c03a527-dc36-466f-a212-a3a24731acf8" />
</div>


A schema-first contract compiler for trustworthy change. Wesley ensures that shared protocols, database migrations, and cross-language boundaries remain technically truthful through bit-exact code generation and evidence-backed conformance.

Wesley is designed for the systems architect who demands a sovereign boundary for their contracts. It scales from automated PostgreSQL migration planning to the compilation of the global Continuum causal protocol.

## Why Wesley?

Unlike traditional code-generators that treat schemas as suggestions, Wesley treats the schema as the sovereign system of record.

- **Contract Sovereignty**: Authored GraphQL SDL is the single source of truth. Generated artifacts (Rust, TS, SQL) are derived surfaces that are never allowed to become peer authorities.
- **Evidence-Backed Change**: Commands like `plan`, `rehearse`, and `witness` produce machine-readable evidence that a proposed change is lawful, safe, and conformant.
- **Cross-Language Inevitability**: By generating bit-exact codecs and IR envelopes, Wesley prevents the "adapter spaghetti" that typically causes multi-repo platforms to rot.
- **Local-First Operation**: The compiler and witness suite run entirely on the local developer workstation, ensuring that contract verification is part of the fast inner-loop.

## Quick Start

### 1. Repository Preflight
Install dependencies and verify the local compiler health.
```bash
pnpm install
pnpm run preflight
```

### 2. Compile a Continuum Contract
Generate manifests and TypeScript targets for a shared causal family.
```bash
pnpm wesley compile \
  --schema ./schemas/continuum-receipt-family.graphql \
  --target warp-ttd,echo \
  --out-dir .wesley-cache/continuum/local-inspect
```

### 3. Verify Conformance
Produce an evidence witness to prove the generated artifacts match the authored truth.
```bash
pnpm wesley witness \
  --scope receipt-family \
  --schema ./schemas/continuum-receipt-family.graphql \
  --out-dir .wesley-cache/continuum/local-inspect
```

## Overall Status

<!-- BEGIN:OVERALL_STATUS -->
Stage: experimental  
Progress: pending
<!-- END:OVERALL_STATUS -->

## Package Matrix

<!-- BEGIN:PACKAGE_MATRIX -->
| Package | Status | Stage | Progress | CI | Notes |
| --- | --- | --- | --- | --- | --- |
<!-- END:PACKAGE_MATRIX -->

## Documentation

- **[Guide](./GUIDE.md)**: Orientation, the fast path, and compiler usage.
- **[Advanced Guide](./ADVANCED_GUIDE.md)**: Deep dives into the IR model, custom directives, and the "Holmes" policy engine.
- **[Architecture](./ARCHITECTURE.md)**: The authoritative system map (Pipeline, Generators, Hosts).
- **[Vision](./docs/VISION.md)**: Core tenets and the "Trustworthy Change" mission.
- **[Method](./docs/method/process.md)**: Repo work doctrine and the cycle loop.

---
Built with bit-exact ambition by [FLYING ROBOTS](https://github.com/flyingrobots)
