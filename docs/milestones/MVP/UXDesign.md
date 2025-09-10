# UX Design — MVP (CLI)

Voice: Transform, not compile. Friendly, confident, factual. Human + JSON modes.

## Copy & Narration
- Transform success: “Transform applied — artifacts updated.”
- No change: “Homeostasis maintained — no artifacts changed.”
- Explain: concise lock levels, phases, affected tables
- Rehearse PASS: “REALM verdict: PASS — smoke drills green.”
- Cert badge: “[REALM] … — PASS ✅”

## Interaction Patterns
- Short commands, explicit flags; helpful hints on errors
- JSON output for CI (`--json`)
- Exit codes map to categories (parse, generation, plan, rehearsal, cert)

## Accessibility
- Default output readable without color; optional pretty logs left to pino-pretty in dev

## Examples (Snippets)
```bash
wesley transform --schema schema.graphql --target postgres,typescript,zod,pgtap
# ✨ Transform applied — 4 artifacts updated (ir@a1b2c3d)

wesley plan --schema schema.graphql --explain
# expand: add column users.age (ROW_EXCLUSIVE)
# validate: VALIDATE CONSTRAINT fk_users_org (SHARE ROW EXCLUSIVE)

wesley rehearse --dsn $SHADOW_DSN
# REALM verdict: PASS — pgTAP: 42 passed, 0 failed, 0 skipped

wesley cert verify --in SHIPME.md
# [REALM] Rehearsed Environment … — PASS ✅
```

