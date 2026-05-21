# Retired: Update Rust core design to optic ontology

## What was retired

The ASAP backlog item `OWN_update-rust-core-design-to-optic-ontology.md` was
retired.

## Why

The Rust core design packet already names the practical boundary Wesley needs
now: Rust compiler kernel, host-neutral capability ABI, host adapters, and
external domain modules. Reframing that packet around broad Continuum ontology
would increase ambiguity during the cleanup release.

## Reopen condition

Reopen only after the IR contract, fixture corpus, and JS/Rust parity sentinel
are stable enough that terminology work can be grounded in executable compiler
truth.
