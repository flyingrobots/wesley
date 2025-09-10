# Codex Dev Log

A running changelog of collaboration between Codex and the team. Append new entries at the top (reverse‑chronological). Keep entries concise and action‑oriented.

## 2025-09-10

- Created branch `fix/critical-issues` and unblocked core transform → plan → rehearse → cert.
  - Parser: added aliases (`primaryKey`→`wes_pk`, `foreignKey`→`wes_fk`), default arg fallback (`value` or `expr`), relation‑only field skip, and scalar mappings (`UUID`, `JSON`, `Date`, `Time`).
  - Files: `packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs`.
  - Examples: switched positional directive args to named args for `@uid`/`@weight`.
  - Files: `example/schema.graphql`, `example/ecommerce.graphql`.
- Verification:
  - `wesley generate --schema example/schema.graphql` now succeeds (DDL + tests emitted).
  - `wesley blade --schema <min> --dry-run` runs end‑to‑end and writes `.wesley/SHIPME.md`.
- Notes:
  - Existing package tests cover E2E flows (`packages/wesley-cli/test/blade.bats`, `cert-e2e.bats`, `plan*.bats`, `rehearse*.bats`).
  - Root `test/` E2E files reference legacy commands (models/typescript/zod); keep archived or update after JS generator wiring.

Next
- Wire `@wesley/generator-js` emit wrappers or adapt host to class APIs (to revive models/zod/types commands and tests).
- Reduce directive validation warnings (extend directive schema or relax best‑effort validator for unknown directives).
- Align README/examples to canonical `@wes_*` or clearly document supported aliases.

## 2025-09-08

- Repo survey and initial assessment completed.
  - Mapped workspace structure, CLI flow, adapters, and generators.
  - Verified CLI help and minimal DDL generation path.
- Neo4j project notes created and proposals recorded.
  - Added observations note; seeded prioritized ideas with rationale under Project `wesley`.
  - Constraints ensured: unique `Project.name`, `Note.id`, `Idea.id`.
- Proposed priority sequence:
  1) Parser aliases + relation field skip (P0).
  2) Align examples vs canonical directives (P0).
  3) Wire generator‑js emit or adapt host (P1).
  4) Evidence bundle with hashes (P1).
  5) Extract shared plan utilities (P2).

Next candidate tasks to pick up:
- Implement parser alias/relations handling; add tests and run example transform.
- Adapt generator‑js to provide emit functions and integrate into runtime writer.

---

Conventions
- One bullet per completed unit of work; reference files/paths when relevant.
- When opening follow‑ups or decisions, add a brief “Next” note.

## 2025-09-08 (later)

- Imported Gemini’s test audit into Neo4j and linked to project.
  - Note added as `kind: test-audit`, `author: gemini` from `docs/milestones/MVP/audits/tests.md`.
  - Extracted 3 test-focused ideas (E2E workflow; Integration flow; Property-based tests) with `author: gemini`.
- Verification: Project now shows Gemini-authored note and ideas alongside Codex items.
- Next: If desired, convert remaining seeded ideas to have explicit `author: codex` for clarity.

## 2025-09-08 (BLADE)

- Scaffolded BLADE demo foundation.
  - Added `demo/blade/README.md` with run instructions and narrative.
  - Added baseline and diff schemas: `demo/blade/schema-v1.graphql`, `demo/blade/schema-v2.graphql`.
- Implemented one‑shot wrapper command `wesley blade`.
  - Orchestrates transform → plan (explain) → rehearse → cert-create → badge.
  - File: `packages/wesley-cli/src/commands/blade.mjs` and program registration.
- Fixed rehearse helper: added missing `emitMigrations()` to avoid runtime error.
  - File: `packages/wesley-cli/src/commands/rehearse.mjs`.
- Dry run: wrapper executed locally and produced a PASS badge and `.wesley/SHIPME.md`.
- Removed example private keys from repo; added `demo/blade/keys/README.md` and .gitignore coverage. Keys are generated locally for demos.
