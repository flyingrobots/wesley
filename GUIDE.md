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
- **Bundle**: `pnpm wesley bundle-echo --schema <path>`
- **Witness**: `pnpm wesley witness --scope receipt-family --schema <path>`
- **Guard**: `pnpm wesley verify-realization --tracked`

### 3. Governance & Inspection
Audit proposed changes and monitor the contract state via the TUI dashboard.
- **Audit**: `pnpm wesley blade --help`
- **TUI**: `pnpm wesley holmes dashboard`

## Big Picture: System Orchestration

Wesley is a tiered engine designed to enforce contract integrity across platforms:

1. **Compiler API (Surfaces)**: The CLI and internal SDK are thin interfaces that communicate with the core. They ensure that all transformations are explicit and logged.
2. **Compiler Core (The Engine)**: Manages the GraphQL parser, the platform-neutral IR, and the transmutation pipeline. It ensures that "Trustworthy Change" is a technical guarantee.
3. **Generators (Memory)**: The Structural Worldline Memory of the contract. Generators transmute IR into physical code (Rust, TS, SQL) while preserving the bit-exact semantics of the authored schema.

## Orientation Checklist

- [ ] **I am setting up the repo**: Run `pnpm install` and `pnpm run preflight`.
- [ ] **I am modifying a schema**: Always start in the `.graphql` file.
- [ ] **I am adding a new generator**: Check `packages/wesley-generator-js` for a baseline.
- [ ] **I am contributing to Wesley**: Read `METHOD.md` and `docs/BEARING.md`.

## Rule of Thumb

If you need a comprehensive command reference, use `pnpm wesley --help`.

If you need to know "what's true right now," use [docs/BEARING.md](./docs/BEARING.md).

If you are just starting, use the [README.md](./README.md) and the orientation tracks above.

---
**The goal is inevitably. Every state transition is a provable consequence of the sovereign schema.**
