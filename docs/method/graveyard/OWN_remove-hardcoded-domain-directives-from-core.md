# Retired: Remove hardcoded domain directives from Rust core

## What was retired

The ASAP backlog item `OWN_remove-hardcoded-domain-directives-from-core.md` was
retired.

## Why

The card's current-state claim is false. `crates/wesley-core/src/domain/ir.rs`
already stores type, field, and argument directives in generic
`IndexMap<String, serde_json::Value>` maps. The referenced hardcoded
`TableDirectives` / `FieldDirectives` Rust IR shape is not current repo truth.

## Reopen condition

Reopen only with fresh evidence against tracked code. Remaining directive work
should be stated as canonical directive storage, fixture parity, or
external-module ownership, not as a stale Rust struct cleanup.
