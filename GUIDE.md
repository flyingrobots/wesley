# Guide — Wesley

This is the developer-level operator guide for Wesley. Use it for orientation, the productive-fast path, and to understand how the contract compiler orchestrates shared truth.

For deep-track doctrine, IR model internals, and custom generator development, use [ADVANCED_GUIDE.md](./ADVANCED_GUIDE.md).

## Choose Your Lane

### 1. Database-Change Lane
Compile GraphQL SDL into PostgreSQL migrations and evidence plans.
- **Run**: `pnpm wesley generate --schema <path> --ops <ops-dir>`
- **Plan**: `pnpm wesley plan --schema <path> --explain`
- **Rehearse**: `pnpm wesley rehearse --schema <path>`

These command paths reuse a hash-addressed IR cache in `.wesley-cache/ir/` when the authored SDL has not changed, which keeps the inner loop tighter across repeated local runs.

### 2. Continuum Contract Lane
Compile shared causal protocols into bit-exact language targets.
- **Compile**: `pnpm wesley compile --schema <path> --target warp-ttd,echo`
- **Contract Release**: `pnpm wesley contract release --profile continuum --family receipt-family --schema <path> --release 0.1.0`
- **Contract Sync**: `pnpm wesley contract sync --profile continuum --bundle <bundle-dir> --consumer warp-ttd --repo ../warp-ttd`
- **Bundle**: `pnpm wesley bundle-echo --schema <path>`
- **Guard**: `pnpm wesley verify-realization --tracked`
- **Witness**: `pnpm wesley witness --scope receipt-family --schema <path>`
- **Drift Watch**: `pnpm wesley drift-watch --scope receipt-family --schema <path> --mirror-root <consumer-root>`

Use `verify-realization` to validate the realization shell for an emitted leg.
Use `witness` to certify the explicit bounded properties named by the chosen
scope. A witness pass is not a blanket claim about runtime or debugger truth.
Use `contract release` when you want one versioned release object rather than a
local inspect root. It emits `bundle.json`, realization, witness, admitted
source metadata, and declared consumer sync projections in one bundle root.
Use `contract sync` when you want to move those declared projections into a
nearby consumer repository without hand-copying generated files.
Use `drift-watch` when you need one local cutover surface that compares authored
schema identity, local emitted legs, and explicit nearby mirrors.

### 3. Governance & Inspection
Audit proposed changes and monitor the contract state via the TUI dashboard.
- **Audit**: `pnpm wesley blade --help`
- **TUI**: `pnpm wesley holmes dashboard`

## Big Picture: System Orchestration

Wesley is a tiered engine designed to enforce contract integrity across platforms:

1. **Compiler API (Surfaces)**: The CLI and internal SDK are thin interfaces that communicate with the core. They ensure that all transformations are explicit and logged.
2. **Compiler Core (The Engine)**: Manages the GraphQL parser, the platform-neutral IR, and the transmutation pipeline. It ensures that "Trustworthy Change" is a technical guarantee.
3. **Realization Shells (Packaging)**: Each emitted leg carries a manifest and signatures that let Wesley verify source identity and artifact integrity without treating generated files as authorities.
4. **Witness Surfaces (Proof)**: Witness commands certify bounded properties against authored source, emitted artifacts, and realization shells. They do not stand in for runtime observation unless a scope explicitly proves that too.

## Orientation Checklist

- [ ] **I am setting up the repo**: Run `pnpm install` and `pnpm run preflight`.
- [ ] **I am modifying a schema**: Always start in the `.graphql` file.
- [ ] **I am adding a new generator**: Check `packages/wesley-generator-js` for a baseline.
- [ ] **I am contributing to Wesley**: Read `METHOD.md` and `docs/BEARING.md`.
- [ ] **I am touching Continuum witness behavior**: Read `docs/design/0004-realization-admission-and-witness/realization-admission-and-witness.md`.
- [ ] **I am shipping a shared Continuum family across repos**: Read `docs/design/0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md`.

## Rule of Thumb

If you need a comprehensive command reference, use `pnpm wesley --help`.

If you need to know "what's true right now," use [docs/BEARING.md](./docs/BEARING.md).

If you need the exact boundary between authored source, realization shells, and
bounded witness claims, use [docs/design/0004-realization-admission-and-witness/realization-admission-and-witness.md](./docs/design/0004-realization-admission-and-witness/realization-admission-and-witness.md).

If you need the release object and cross-repo sync model for Continuum
consumers, use [docs/design/0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md](./docs/design/0005-continuum-contract-bundle-release-and-sync/continuum-contract-bundle-release-and-sync.md).

If you are just starting, use the [README.md](./README.md) and the orientation tracks above.

---
**The goal is inevitably. Every state transition is a provable consequence of the sovereign schema.**
