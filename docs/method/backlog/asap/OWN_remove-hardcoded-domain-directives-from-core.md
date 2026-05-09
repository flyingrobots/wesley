# OWN: Remove Hardcoded Domain Directives from Rust Core

- Lane: `asap`
- Legend: `OWN`

## Why (Bad Code)

The current Rust `WesleyIR` implementation (`crates/wesley-core/src/domain/ir.rs`) has hardcoded fields for `@wes_rls`, `@wes_tenant`, `@wes_audit`, and `@wes_soft_delete`.

According to Wesley doctrine, these are PostgreSQL-specific semantics and do not belong in the domain-empty core. Their presence in the core creates a "God Kernel" anti-pattern and violates the hard boundary defined in `docs/ARCHITECTURE.md`.

## Done looks like

- `TableDirectives` and `FieldDirectives` structs in Rust are refactored to use generic maps (e.g., `IndexMap<String, serde_json::Value>`).
- The `LoweringEngine` stores directives by their canonical name without looking at their specific meanings.
- Specific domain knowledge of `rls`, `tenant`, etc., is moved to external modules (or the future `wesley-postgres` repository).
- Parity fixtures are updated to ensure generic directive storage still produces the same hashes.

## Repo Evidence

- `crates/wesley-core/src/domain/ir.rs:59`
- `crates/wesley-core/src/adapters/apollo.rs:161`
