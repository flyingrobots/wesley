# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
- Core (QIR): add `lowerToSQL` for SELECT/JOIN/LATERAL/ORDER BY/LIMIT/OFFSET with null/IN semantics and `jsonb_agg` COALESCE.
- Core (QIR): add `emitView` and `emitFunction` (RETURNS SETOF jsonb) for deterministic operation wrappers.
- Tests: unit + snapshot tests for lowering and emission.
- Docs: new guide docs/guides/qir-ops.md; add PR template and CODEOWNERS.
- CI: Ubuntu-only CLI matrix to control Actions costs; stabilized architecture-boundaries workflow.

## [0.1.0] - 2025-09-01
- Initial public repository layout
