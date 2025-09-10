# MVP User Stories and Acceptance Criteria

## Roles
- Application Developer (Dev)
- Infra/DBA (Ops)
- Reviewer/Lead (Lead)
- CI/CD Pipeline (CI)

## Stories

1) As a Dev, I transform a schema into SQL/Types/Zod/pgTAP
- Given a valid GraphQL SDL with Wesley directives
- When I run `wesley transform --schema schema.graphql --target postgres,typescript,zod,pgtap`
- Then I see generated artifacts in the output dir, and a validated evidence bundle with artifact hashes

Acceptance:
- Evidence schemas pass (ajv)
- Artifacts include at least: schema.sql, tests.sql, types.ts, zod.ts

2) As a Dev, I preview a lock-aware plan before running it
- When I run `wesley plan --schema schema.graphql --explain`
- Then I see phases (expand/backfill/validate/switch/contract) and lock levels listed per step

Acceptance:
- Explain shows CIC, NOT VALID, VALIDATE steps and affected tables

3) As a Dev, I rehearse the plan safely
- When I run `wesley rehearse --dsn <shadow>`
- Then the plan applies on shadow DB and pgTAP passes

Acceptance:
- Plan executes successfully (or fails with actionable output)
- pgTAP summary printed; .wesley/realm.json written with PASS/FAIL

4) As a Lead, I require a signed certificate to deploy
- When I run `wesley cert create|sign|verify`
- Then SHIPME.md contains scores, plan summary, pgTAP results, REALM verdict, and signatures

Acceptance:
- `wesley cert verify` returns success; badge prints PASS
- Missing/invalid SHIPME makes `wesley deploy` refuse (unless forced)

5) As CI, I gate merges on thresholds
- Given default thresholds (SCS ≥ 0.8, MRI ≤ 0.4, TCI ≥ 0.7)
- When CI runs `wesley validate-bundle` and `wesley cert verify`
- Then the pipeline fails if thresholds are not met

Acceptance:
- Clear exit codes and JSON logs for machine consumption

## Non-Goals (MVP)
- Destructive diffs beyond explain-only
- Traffic mirroring for REALM
- Visual dashboards

