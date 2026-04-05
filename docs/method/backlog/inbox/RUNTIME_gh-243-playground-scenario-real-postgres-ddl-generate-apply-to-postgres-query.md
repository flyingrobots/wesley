# GH-243 Playground scenario: Real Postgres DDL (generate, apply to Postgres, query)

- Imported from: GitHub issue
- Issue: #243
- URL: https://github.com/flyingrobots/wesley/issues/243
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:29Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Playground scenario: Real Postgres DDL (generate, apply, query)

## Overview

Demonstrate real Postgres DDL emission and application in the browser (no persistence). Include a query panel to run simple SELECTs.

## Acceptance Criteria
- [ ] The user can generate Postgres DDL from GraphQL in-browser
- [ ] The user can apply the generated DDL to Postgres in-browser
- [ ] The user can use a query editor to query the database in-browser
- [ ] The user can generate Postgres migration from GraphQL mutation in-browser
- [ ] The user can apply Postgres migration to live Postgres database in-browser

## Definition of Done

- Tests / validation: Default example applies cleanly; SELECT returns expected rows.
- Docs / comms touched: Add a short tutorial to the Playground page.

## In-Scope

- [ ] Displaying/editing GraphQL in the browser
- [ ] Running the Wesley compiler in-browser
- [ ] Connecting to Postgres

## Out of Scope

- [ ] Shadow REALM
- [ ] HOLMES inspection
- [ ] SHIPME cert

## Links

- Primary reference: `docs/drafts/playground-demo-scenarios.md`

*NOTE* this is an Umbrella task and part of the "Wesley Website" milestone/Wesley Anywhere.
