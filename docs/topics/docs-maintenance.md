# Docs Maintenance

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when editing documentation or deciding whether a new signpost
belongs in the repo.

Docs are a product interface and an evidence ledger. They are not a live
backlog, status board, or progress counter.

## Maintenance Rules

- Give each page one primary job: tutorial, how-to, reference, explanation,
  troubleshooting, contributor guide, or evidence.
- Keep live work state in GitHub Issues, Milestones, Projects, and labels.
- Update `docs/truth-manifest.json` when adding or changing public or
  governance signposts that should be checked.
- Update `docs/topics/` when a release changes contributor or operator
  workflows.
- Do not leave TODOs or hidden backlog state in prose.

## Local Checks

```bash
cargo xtask docs-check
git diff --check
pnpm exec prettier --check <changed-markdown-files>
```

For release prep, also audit `docs/topics/` for accuracy and coverage against
the actual release diff.

## Topic Coverage Standard

Every public capability should have an obvious path to:

- orientation or explanation
- command, API, schema, or invariant reference
- at least one runnable or clearly illustrative example when useful
- troubleshooting or known failure behavior when relevant
- release or closeout evidence when recently shipped

Topic pages may summarize and route. They should not duplicate full reference
pages or live roadmap state.

## Related Authority

- [Documentation Standard](../governance/DOCUMENTATION_STANDARD.md)
- [Topics Index](./README.md)
- [Releases](./releases.md)
- [Validation](./validation.md)
