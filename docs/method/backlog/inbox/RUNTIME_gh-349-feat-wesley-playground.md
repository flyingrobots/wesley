# GH-349 [feat] Wesley Playground

- Imported from: GitHub issue
- Issue: #349
- URL: https://github.com/flyingrobots/wesley/issues/349
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:46:11Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `feature`, `Website`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

### Problem Statement

## User Story

|    |   |
|----|---|
| **As a** | Potential Wesley user |
| **I want** | To try Wesley in the browser |
| **So that** | There is zero friction to try it out |

## Summary

To reduce the friction for users to try Wesley, we'll provide a "Playground" on the Wesley Website, where users can run the full stack:

- Compile GraphQL to Postgres DDL
- Apply generated Postgres DDL to a real Postgres database
- Edit GraphSQL schema and produce a Postgres migration file
- Apply the migration to the live Postgres database using the full end-to-end Shadow REALM/SHA-lock HOLMES workflow.
- User gets to live out the "Deploy on a Friday" UX, in-browser

## Acceptance Criteria

- [ ] Playground page exists
- [ ] Ability to generate postgres DDL
- [ ] Ability to generate postgres migration
- [ ] Ability to use BLADE to run the ShadowREALM and SHA-lock to certify the migration

**NOTE** This is an umbrella task

### Proposed Solution

1. Build Playground webpage with:
  - [ ] editor-like UX for GraphQL
  - [ ] viewer/read-only UX for Wesley build output and build artifacts 
  - [ ] "File tree" viewer
  - [ ] "Generate" button that actually runs Wesley in-browser
  - [ ] "Postgres" tab where you can query the database and view query results
2. Postgres in-browser
3. Shadow REALM runs in-browser, targeting local Postgres instance
4. Workers to run Wesley and other background stuff
5. All happens client-side, in the browser

**NOTE** Do not use actual Postgres backend/avoid doing anything server-side.


### Alternatives Considered

- Connect to Supabase
- Not doing this feature at all

### Impact Areas

- [x] CLI
- [x] Docs
- [x] API
- [x] Infra/CI
- [ ] Other

### Priority

None
